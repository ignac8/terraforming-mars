import {IGame} from '../IGame';
import {Database} from '../database/Database';
import {RouteError} from '../routes/RouteError';
import {SerializedGame} from '../SerializedGame';
import {loadSandboxGame} from './sandbox';
import {Phase} from '../../common/Phase';
import {GameId, ParticipantId, PlayerId} from '../../common/Types';
import {playerColors, toJudgeMessage} from '../routes/GameLogs';
import {ReplayMove, ReplayMovesModel} from '../../common/replay/ReplayModel';
import {LogMessage} from '../../common/logs/LogMessage';
import {isAbandonedSave, RewindRecord} from '../rewind/RewindRecord';
import {canBrowseHistory, canRewind, canVoteRewind, checkMayShowUndone, judgeCanRewind} from '../rewind/access';
import {answerersOf, buildMoveList, SaveEntry} from './moveList';

const MAX_CACHED_GAMES = 50;

// A finished game does not change, so what its move list is built from is kept: the saves, the
// rewinds and the one log that every save is a prefix of. The list holds every message, so it
// is the same for all viewers; each request filters the private lines for its own viewer.
// A running game keeps only its saves. Rows are append-only between rollbacks, which undo and
// load_game are and forgetReplay covers, so the next request extends them. Its rewinds and log
// are the live game's. Oldest entries go first.
type CachedGame =
  | {finished: true, saves: Array<SaveEntry>, rewinds: Array<RewindRecord>, log: Array<LogMessage>}
  | {finished: false, saves: Array<SaveEntry>};
type FinishedGame = Extract<CachedGame, {finished: true}>;
const cache = new Map<GameId, CachedGame>();

type Built = {status: 'available', game: FinishedGame} | {status: 'not-finished'} | {status: 'expired'};

// Builds in progress, so viewers who ask at the same time share one pass over the saves.
const building = new Map<GameId, Promise<Built>>();

// Reads of a running game's saves in progress, shared the same way.
const runningReads = new Map<GameId, Promise<Array<SaveEntry>>>();

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
  runningReads.clear();
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
  runningReads.delete(gameId);
  finishedGames.delete(gameId);
  for (const key of sandboxes.keys()) {
    if (key.startsWith(`${gameId}/`)) {
      sandboxes.delete(key);
    }
  }
}

function remember(gameId: GameId, entry: CachedGame): void {
  if (!cache.has(gameId) && cache.size >= MAX_CACHED_GAMES) {
    for (const oldest of cache.keys()) {
      cache.delete(oldest);
      break;
    }
  }
  cache.set(gameId, entry);
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

// Who gave the answers since the save `newestId`, the newest one, from the live game. A game loaded from that
// save has not saved since, so what it holds are the answers that led to the save, not the ones after it. Phases
// that ask again without saving, like a draft, leave it so.
function answersSince(game: IGame, newestId: number): Array<PlayerId> {
  return game.lastSaveId > newestId ? answerersOf(game.inputsSinceSave) : [];
}

function entryOf(saveId: number, save: SerializedGame): SaveEntry {
  return {saveId, logLength: save.gameLog.length, answeredBy: answerersOf(save.inputs)};
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
      saves.push(entryOf(saveId, save));
    }
  } catch (e) {
    // Compression can strike while the saves are read. Only the first and last remain then.
    if ((await getSortedSaveIds(game)).length < 3) {
      return {result: {status: 'expired'}, finished: true};
    }
    throw e;
  }
  return {result: {status: 'available', game: {finished: true, saves, rewinds: newest.rewinds ?? [], log: newest.gameLog}}, finished: true};
}

function build(game: IGame): Promise<Built> {
  const pending: Promise<Built> = readGame(game).then(({result, finished}) => {
    // Not remembered if a rollback made forgetReplay run in the meantime.
    if (building.get(game.id) === pending) {
      if (finished) {
        rememberFinished(game.id);
      }
      if (result.status === 'available') {
        remember(game.id, result.game);
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

// Extends `known` with the saves from its newest one on. The newest one is read again, since a
// reload can save it in place with a longer log.
async function extendRunningSaves(game: IGame, known: ReadonlyArray<SaveEntry>): Promise<Array<SaveEntry>> {
  const from = known.length > 0 ? known[known.length - 1].saveId : 0;
  const saves = known.slice(0, -1);
  for (const saveId of (await getSortedSaveIds(game)).filter((id) => id >= from)) {
    saves.push(entryOf(saveId, await getSave(game, saveId)));
  }
  return saves;
}

// The saves of a running game. Requests that arrive together share one read. A rollback during
// the read runs forgetReplay, and then the result is not remembered.
function readRunningSaves(game: IGame): Promise<Array<SaveEntry>> {
  const inFlight = runningReads.get(game.id);
  if (inFlight !== undefined) {
    return inFlight;
  }
  const known = cache.get(game.id);
  const pending: Promise<Array<SaveEntry>> = extendRunningSaves(game, known !== undefined && !known.finished ? known.saves : [])
    .catch(() => {
      // A row can vanish between listing the ids and reading it, as in a rollback. Start over once.
      cache.delete(game.id);
      return extendRunningSaves(game, []);
    })
    .then((saves) => {
      if (runningReads.get(game.id) === pending) {
        remember(game.id, {finished: false, saves});
      }
      return saves;
    })
    .finally(() => {
      if (runningReads.get(game.id) === pending) {
        runningReads.delete(game.id);
      }
    });
  runningReads.set(game.id, pending);
  return pending;
}

function movesFor(game: IGame, viewerId: ParticipantId, moves: Array<ReplayMove>): Array<ReplayMove> {
  // The judge page shows every private line, so the judge's replay does too, in the same form.
  const colors = viewerId === game.judgeId ? playerColors(game) : undefined;
  return moves.map((move) => ({
    ...move,
    messages: colors !== undefined ?
      move.messages.map((m) => toJudgeMessage(m, colors)) :
      move.messages.filter((m) => m.playerId === undefined || m.playerId === viewerId),
  }));
}

type AllMoves = {status: 'available', moves: Array<ReplayMove>, finished: boolean} | {status: 'not-finished'} | {status: 'expired'};

// Every move of the game with every message, the same for every viewer. `undone` adds the moves that rewinds undid.
async function allMoves(game: IGame, undone: boolean = false): Promise<AllMoves> {
  const colors = new Map(game.players.map((p) => [p.id, p.color]));
  // The live phase comes first: a game that a rollback reopened must not serve its old list.
  if (game.phase !== Phase.END) {
    const saves = await readRunningSaves(game);
    // The newest save's move is the one the game is at, which its inputs since that save tell.
    const movers = {colors, newest: answersSince(game, saves[saves.length - 1]?.saveId ?? -1)};
    return {status: 'available', moves: buildMoveList(saves, game.rewinds, game.gameLog, undone, movers), finished: false};
  }
  const cached = cache.get(game.id);
  const result: Built = cached?.finished ?
    {status: 'available', game: cached} :
    await (building.get(game.id) ?? build(game));
  if (result.status !== 'available') {
    return result;
  }
  const {saves, rewinds, log} = result.game;
  return {status: 'available', moves: buildMoveList(saves, rewinds, log, undone, {colors}), finished: true};
}

/**
 * The players who made the move from the state of save `saveId`: everyone who gave an answer recorded in the save
 * after it, or in the live game when it is the newest, in the order of their first answer. Empty when that is not
 * known, as for a save written before answers were recorded, or when no answer follows it.
 */
export async function moversOf(game: IGame, saveId: number): Promise<Array<PlayerId>> {
  const next = (await getSortedSaveIds(game)).find((id) => id > saveId);
  return next === undefined ? answersSince(game, saveId) : answerersOf((await getSave(game, next)).inputs);
}

/**
 * The save ids of the game's move list, the same for every viewer. Undefined when its history is gone (compressed),
 * or when the game has ended and its final save has not landed yet. `undone`: the list of the judge or the
 * solo player, with the moves that rewinds undid.
 */
export async function historySaveIds(game: IGame, options: {undone?: boolean} = {}): Promise<Array<number> | undefined> {
  const all = await allMoves(game, options.undone === true);
  return all.status === 'available' ? all.moves.map((move) => move.saveId) : undefined;
}

/**
 * `undone`: the list with the moves that rewinds undid, each marked. Refused unless the viewer
 * is the judge of a Judge undo game or the player of a solo game (see checkMayShowUndone).
 */
export async function getReplayMoves(game: IGame, viewerId: ParticipantId, options: {undone?: boolean} = {}): Promise<ReplayMovesModel> {
  const undone = options.undone === true;
  if (undone) {
    checkMayShowUndone(game, viewerId);
  }
  if (game.phase !== Phase.END && !canBrowseHistory(game, viewerId)) {
    return {status: 'not-finished'};
  }
  const all = await allMoves(game, undone);
  if (all.status !== 'available') {
    return all;
  }
  // Everyone but the judge sees only their own view while the game runs.
  const own = game.players.find((p) => p.id === viewerId);
  return {
    status: 'available',
    moves: movesFor(game, viewerId, all.moves),
    finished: all.finished,
    canRewind: canRewind(game, viewerId) || judgeCanRewind(game, viewerId),
    canVoteRewind: canVoteRewind(game, viewerId),
    defaultViewAs: all.finished ? 'all' : own?.color ?? 'all',
    viewerColor: own?.color,
  };
}

/**
 * Returns the game as it was at `saveId`. The game is a sandbox: it never writes anything, and
 * callers share it, so they must only read it. `undone`: a save that a rewind abandoned may be
 * loaded too. Only the requests of the judge and the solo player pass it.
 */
export function loadReplayState(game: IGame, saveId: number, options: {undone?: boolean} = {}): Promise<IGame> {
  if (options.undone !== true && isAbandonedSave(saveId, game.rewinds)) {
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
