import {Random} from '../../common/utils/Random';

/**
 * Returns a new array with `seats` in a uniformly random order (Fisher-Yates), leaving `seats` unchanged.
 */
export function shuffleSeats<T>(seats: ReadonlyArray<T>, random: Random): Array<T> {
  const shuffled = [...seats];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = random.nextInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
