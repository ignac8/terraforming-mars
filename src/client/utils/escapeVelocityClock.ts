import {Timer} from '@/common/Timer';
import {TimerModel} from '@/common/models/TimerModel';
import {EscapeVelocityOptions} from '@/common/game/NewGameConfig';

/**
 * Returns the milliseconds a player may use before the Escape Velocity penalty starts: the threshold plus
 * the time their `actions` have earned back. Undefined when the game has no Escape Velocity.
 */
export function escapeVelocityAllowanceMs(options: EscapeVelocityOptions | undefined, actions: number): number | undefined {
  if (options === undefined) {
    return undefined;
  }
  return options.thresholdMinutes * 60_000 + actions * options.bonusSectionsPerAction * 1000;
}

/**
 * Returns how much of `allowanceMs` is left on `timer`, in the format of `Timer.toString`.
 * Past the allowance it is the time over, with a minus sign.
 */
export function remainingTimerText(timer: TimerModel, allowanceMs: number): string {
  const elapsedMs = timer.sumElapsed + (timer.running ? Date.now() - timer.startedAt : 0);
  const remainingMs = allowanceMs - elapsedMs;
  const text = Timer.toString({sumElapsed: Math.abs(remainingMs), startedAt: 0, running: false});
  return remainingMs <= -1000 ? '-' + text : text;
}
