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

export async function getReplayMoves(game: IGame, viewerId: ParticipantId): Promise<ReplayMovesModel> {
  if (game.phase !== Phase.END) {
    return {status: 'not-finished'};
  }

  const key = `${game.id}/${viewerId}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const saveIds = await getSortedSaveIds(game);
  // After compression only the first and last save remain.
  if (saveIds.length < 3) {
    return {status: 'expired'};
  }

  const db = Database.getInstance();
  const saves: Array<{saveId: number, save: SerializedGame}> = [];
  for (const saveId of saveIds) {
    saves.push({saveId, save: await db.getGameVersion(game.id, saveId)});
  }

  // The game sets its phase to END before the final save is written. Until that save lands the
  // list would be wrong, and it must not be cached.
  if (saves[saves.length - 1].save.phase !== Phase.END) {
    return {status: 'not-finished'};
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
  return loadSandboxGame(await Database.getInstance().getGameVersion(game.id, saveId));
}
