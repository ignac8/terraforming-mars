import {ReplayMove} from '@/common/replay/ReplayModel';

/** Autoplay in fixed mode stays this long on a move at speed 1. */
export const FIXED_STEP_MS = 1000;
/** Real time never stays on a move for less than this, however quick the answer was. */
export const REAL_TIME_MIN_MS = 300;
/** Real time never stays on a move for longer than this, however long the player thought. */
export const REAL_TIME_MAX_MS = 20_000;

/** When the answer that left the move was given. Old saves have no such time, and then its first log line tells about as well. */
function answeredAt(move: ReplayMove | undefined): number | undefined {
  return move?.at ?? move?.messages[0]?.timestamp;
}

/**
 * How long autoplay stays on the move at `index` before it shows the next. Fixed mode waits the same for every move.
 * Real time waits as long as the player took to answer the move before: the time between the answer that led to this
 * move and the answer that leaves it, kept within `REAL_TIME_MIN_MS` and `REAL_TIME_MAX_MS`. It falls back to the fixed
 * wait for the first move and for a move that has no time on either side. `speed` divides both waits.
 */
export function autoplayDelay(moves: ReadonlyArray<ReplayMove>, index: number, speed: number, realTime: boolean): number {
  const fixed = FIXED_STEP_MS / speed;
  if (!realTime) {
    return fixed;
  }
  const left = answeredAt(moves[index]);
  const arrived = answeredAt(moves[index - 1]);
  if (left === undefined || arrived === undefined) {
    return fixed;
  }
  return Math.min(Math.max((left - arrived) / speed, REAL_TIME_MIN_MS), REAL_TIME_MAX_MS);
}
