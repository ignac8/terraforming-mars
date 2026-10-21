import {IGame} from '../IGame';
import {Database} from '../database/Database';
import {RouteError} from '../routes/RouteError';
import {SerializedGame} from '../SerializedGame';
import {loadSandboxGame} from './sandbox';
import {Phase} from '../../common/Phase';
import {ParticipantId} from '../../common/Types';
import {ReplayMove, ReplayMovesModel} from '../../common/replay/ReplayModel';

const MAX_CACHED_MOVE_LISTS = 50;

// A finished game does not change, so its move list is kept. Messages depend on who is
// looking (private lines), so the key includes the viewer. Oldest entries go first.
const cache = new Map<string, ReplayMovesModel>();

export function clearReplayCache(): void {
  cache.clear();
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
    throw e instanceof RouteError ? e : RouteError.notFound('save not available');
  }
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
  const saveIds = await getSortedSaveIds(game);
  if (saveIds.length === 0) {
    return false;
  }
  return (await getSave(game, saveIds[saveIds.length - 1])).phase === Phase.END;
}

export async function getReplayMoves(game: IGame, viewerId: ParticipantId): Promise<ReplayMovesModel> {
  const key = `${game.id}/${viewerId}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  if (!await isFinished(game)) {
    return {status: 'not-finished'};
  }

  const saveIds = await getSortedSaveIds(game);
  // After compression only the first and last save remain.
  if (saveIds.length < 3) {
    return {status: 'expired'};
  }

  const saves: Array<{saveId: number, save: SerializedGame}> = [];
  for (const saveId of saveIds) {
    saves.push({saveId, save: await getSave(game, saveId)});
  }

  // A save with the same log length as the next one changed nothing a viewer can see,
  // e.g. the two saves at the end of the game.
  const kept = saves.filter((entry, idx) => {
    const next = saves[idx + 1];
    return next === undefined || next.save.gameLog.length !== entry.save.gameLog.length;
  });

  const finalLog = saves[saves.length - 1].save.gameLog;
  const moves: Array<ReplayMove> = kept.map((entry, idx) => {
    const start = entry.save.gameLog.length;
    const next = kept[idx + 1];
    const end = next === undefined ? start : next.save.gameLog.length;
    const messages = finalLog.slice(start, end).filter((m) => m.playerId === undefined || m.playerId === viewerId);
    return {saveId: entry.saveId, generation: entry.save.generation, messages};
  });

  const result: ReplayMovesModel = {status: 'available', moves};
  if (cache.size >= MAX_CACHED_MOVE_LISTS) {
    for (const oldest of cache.keys()) {
      cache.delete(oldest);
      break;
    }
  }
  cache.set(key, result);
  return result;
}

/** Returns the game as it was at `saveId`. The game is a sandbox: it never writes anything. */
export async function loadReplayState(game: IGame, saveId: number): Promise<IGame> {
  const saveIds = await getSortedSaveIds(game);
  if (!saveIds.includes(saveId)) {
    throw RouteError.notFound();
  }
  const save = await getSave(game, saveId);
  try {
    return loadSandboxGame(save);
  } catch (e) {
    // A save that this version of the code cannot read.
    throw e instanceof RouteError ? e : RouteError.notFound('save not available');
  }
}
