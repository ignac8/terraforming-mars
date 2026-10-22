import {IGame} from '../IGame';
import {Database} from '../database/Database';
import {RouteError} from '../routes/RouteError';
import {SerializedGame} from '../SerializedGame';
import {loadSandboxGame} from './sandbox';
import {Phase} from '../../common/Phase';
import {GameId, ParticipantId} from '../../common/Types';
import {playerColors, toJudgeMessage} from '../routes/GameLogs';
import {ReplayMovesModel} from '../../common/replay/ReplayModel';
import {LogMessage} from '../../common/logs/LogMessage';
import {isAbandonedSave, RewindRecord} from '../rewind/RewindRecord';
import {buildMoveList, SaveEntry} from './moveList';

const MAX_CACHED_GAMES = 50;

// A finished game does not change, so what its move list is built from is kept: the saves, the
// rewinds and the one log that every save is a prefix of. The list holds every message, so it
// is the same for all viewers; each request filters the private lines for its own viewer.
// Oldest entries go first.
type CachedGame = {saves: Array<SaveEntry>, rewinds: Array<RewindRecord>, log: Array<LogMessage>};
const cache = new Map<GameId, CachedGame>();

type Built = {status: 'available', game: CachedGame} | {status: 'not-finished'} | {status: 'expired'};

// Builds in progress, so viewers who ask at the same time share one pass over the saves.
const building = new Map<GameId, Promise<Built>>();

const MAX_FINISHED_GAMES = 1000;

// Games whose newest save was seen in the END phase. A finished game stays finished, so the
// check for it needs no database reads the next time. Oldest entries go first.
const finishedGames = new Set<GameId>();

const MAX_CACHED_SANDBOXES = 8;

// Sandboxes of recent views, keyed `${gameId}/${saveId}`, so paging through a replay does not
// deserialize a save for every request. Viewers only read a sandbox, so they share it. The map
// is in order of use: the least recently used entry goes first.
const sandboxes = new Map<string, Promise<IGame>>();

export function clearReplayCache(): void {
  cache.clear();
  building.clear();
  finishedGames.clear();
  sandboxes.clear();
}

/**
 * Forgets what is known about one game's replay, for when its saves change, as in a rollback.
 * A build that is still running keeps serving the requests that wait for it, but its result is
 * not remembered.
 */
export function forgetReplay(gameId: GameId): void {
  cache.delete(gameId);
  building.delete(gameId);
  finishedGames.delete(gameId);
  for (const key of sandboxes.keys()) {
    if (key.startsWith(`${gameId}/`)) {
      sandboxes.delete(key);
    }
  }
}

function rememberFinished(gameId: GameId): void {
  if (finishedGames.size >= MAX_FINISHED_GAMES) {
    for (const oldest of finishedGames) {
      finishedGames.delete(oldest);
      break;
    }
  }
  finishedGames.add(gameId);
}

async function getSortedSaveIds(game: IGame): Promise<Array<number>> {
  const saveIds = await Database.getInstance().getSaveIds(game.id);
  return [...saveIds].sort((a, b) => a - b);
}

// Compression can remove a save between listing the ids and reading it. Treat that like any
// other missing save instead of letting the error become a 500.
async function getSave(game: IGame, saveId: number): Promise<SerializedGame> {
  try {
    return await Database.getInstance().getGameVersion(game.id, saveId);
  } catch (e) {
    throw unreadable(game, saveId, e);
  }
}

// Keeps the cause in the server log, since the client only gets a 404.
function unreadable(game: IGame, saveId: number, e: unknown): unknown {
  if (e instanceof RouteError) {
    return e;
  }
  console.warn(`replay: unable to read save ${saveId} of ${game.id}`, e);
  return RouteError.notFound('save not available');
}

/**
 * A game can be replayed once it is in the END phase and its newest save is too. The game sets
 * its phase to END before the final save is written, and until that save lands the list of
 * saves is incomplete.
 */
export async function isFinished(game: IGame): Promise<boolean> {
  if (game.phase !== Phase.END) {
    return false;
  }
  if (finishedGames.has(game.id)) {
    return true;
  }
  const saveIds = await getSortedSaveIds(game);
  if (saveIds.length === 0) {
    return false;
  }
  if ((await getSave(game, saveIds[saveIds.length - 1])).phase !== Phase.END) {
    return false;
  }
  rememberFinished(game.id);
  return true;
}

// Reads the saves one at a time and keeps only what the list needs, so at most one save is in
// memory at once, besides the newest, which is read first.
async function readGame(game: IGame): Promise<{result: Built, finished: boolean}> {
  const saveIds = await getSortedSaveIds(game);
  if (saveIds.length === 0) {
    return {result: {status: 'not-finished'}, finished: false};
  }
  // The newest save is read first, so a game whose END save has not landed costs one read.
  const newestId = saveIds[saveIds.length - 1];
  const newest = await getSave(game, newestId);
  if (newest.phase !== Phase.END) {
    return {result: {status: 'not-finished'}, finished: false};
  }
  // After compression only the first and last save remain.
  if (saveIds.length < 3) {
    return {result: {status: 'expired'}, finished: true};
  }

  const saves: Array<SaveEntry> = [];
  try {
    for (const saveId of saveIds) {
      const save = saveId === newestId ? newest : await getSave(game, saveId);
      saves.push({saveId, logLength: save.gameLog.length});
    }
  } catch (e) {
    // Compression can strike while the saves are read. Only the first and last remain then.
    if ((await getSortedSaveIds(game)).length < 3) {
      return {result: {status: 'expired'}, finished: true};
    }
    throw e;
  }
  return {result: {status: 'available', game: {saves, rewinds: newest.rewinds ?? [], log: newest.gameLog}}, finished: true};
}

function build(game: IGame): Promise<Built> {
  const pending: Promise<Built> = readGame(game).then(({result, finished}) => {
    // Not remembered if a rollback made forgetReplay run in the meantime.
    if (building.get(game.id) === pending) {
      if (finished) {
        rememberFinished(game.id);
      }
      if (result.status === 'available') {
        if (cache.size >= MAX_CACHED_GAMES) {
          for (const oldest of cache.keys()) {
            cache.delete(oldest);
            break;
          }
        }
        cache.set(game.id, result.game);
      }
    }
    return result;
  }).finally(() => {
    if (building.get(game.id) === pending) {
      building.delete(game.id);
    }
  });
  building.set(game.id, pending);
  return pending;
}

export async function getReplayMoves(game: IGame, viewerId: ParticipantId): Promise<ReplayMovesModel> {
  // The live phase comes first: a game that a rollback reopened must not serve its old list.
  if (game.phase !== Phase.END) {
    return {status: 'not-finished'};
  }
  const cached = cache.get(game.id);
  const result: Built = cached !== undefined ?
    {status: 'available', game: cached} :
    await (building.get(game.id) ?? build(game));
  if (result.status !== 'available') {
    return result;
  }
  // The judge page shows every private line, so the judge's replay does too, in the same form.
  const colors = viewerId === game.judgeId ? playerColors(game) : undefined;
  const {saves, rewinds, log} = result.game;
  const moves = buildMoveList(saves, rewinds, log).map(({saveId, messages}) => ({
    saveId,
    messages: colors !== undefined ?
      messages.map((m) => toJudgeMessage(m, colors)) :
      messages.filter((m) => m.playerId === undefined || m.playerId === viewerId),
  }));
  return {status: 'available', moves};
}

/**
 * Returns the game as it was at `saveId`. The game is a sandbox: it never writes anything, and
 * callers share it, so they must only read it.
 */
export function loadReplayState(game: IGame, saveId: number): Promise<IGame> {
  if (isAbandonedSave(saveId, game.rewinds)) {
    return Promise.reject(RouteError.notFound());
  }
  const key = `${game.id}/${saveId}`;
  const cached = sandboxes.get(key);
  if (cached !== undefined) {
    sandboxes.delete(key);
    sandboxes.set(key, cached);
    return cached;
  }
  const pending: Promise<IGame> = readSandbox(game, saveId).then(({sandbox, keep}) => {
    if (!keep && sandboxes.get(key) === pending) {
      sandboxes.delete(key);
    }
    return sandbox;
  }, (e) => {
    if (sandboxes.get(key) === pending) {
      sandboxes.delete(key);
    }
    throw e;
  });
  sandboxes.set(key, pending);
  if (sandboxes.size > MAX_CACHED_SANDBOXES) {
    for (const oldest of sandboxes.keys()) {
      sandboxes.delete(oldest);
      break;
    }
  }
  return pending;
}

// `keep` is false for the newest save of a running game, which a reload re-saves in place under
// the same id.
async function readSandbox(game: IGame, saveId: number): Promise<{sandbox: IGame, keep: boolean}> {
  const saveIds = await getSortedSaveIds(game);
  if (!saveIds.includes(saveId)) {
    throw RouteError.notFound();
  }
  const save = await getSave(game, saveId);
  try {
    const keep = game.phase === Phase.END || saveId !== saveIds[saveIds.length - 1];
    return {sandbox: loadSandboxGame(save), keep};
  } catch (e) {
    // A save that this version of the code cannot read.
    throw unreadable(game, saveId, e);
  }
}
