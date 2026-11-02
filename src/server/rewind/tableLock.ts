import {RouteError} from '../routes/RouteError';
import {GameId} from '../../common/Types';

// Games with a table operation in progress.
const locked = new Set<GameId>();

/**
 * Runs `f` while no other table operation (a rewind, a freeze, an unfreeze) of the game runs. The lock is taken
 * synchronously on call, before the first await, and refused with 'A rewind is already running.' when held.
 */
export async function withTableLock<T>(gameId: GameId, f: () => Promise<T>): Promise<T> {
  if (locked.has(gameId)) {
    throw RouteError.badRequest('A rewind is already running.');
  }
  locked.add(gameId);
  try {
    return await f();
  } finally {
    locked.delete(gameId);
  }
}

/** Whether a table operation of the game is running. */
export function isTableLocked(gameId: GameId): boolean {
  return locked.has(gameId);
}
