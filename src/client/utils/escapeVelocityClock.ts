import {Timer} from '@/common/Timer';
import {TimerModel} from '@/common/models/TimerModel';
import {EscapeVelocityOptions} from '@/common/game/NewGameConfig';

/**
 * Returns the milliseconds that `actions` take off a player's clock when the Escape Velocity penalty is
 * worked out, or undefined when the game takes nothing off.
 */
export function escapeVelocityCreditMs(options: EscapeVelocityOptions | undefined, actions: number): number | undefined {
  if (options === undefined || !(options.bonusSectionsPerAction > 0)) {
    return undefined;
  }
  return actions * options.bonusSectionsPerAction * 1000;
}

/** Returns `timer` as text, in the format of `Timer.toString`, with `creditMs` taken off but never below zero. */
export function countedTimerText(timer: TimerModel, creditMs: number): string {
  const elapsedMs = timer.sumElapsed + (timer.running ? Date.now() - timer.startedAt : 0);
  return Timer.toString({sumElapsed: Math.max(elapsedMs - creditMs, 0), startedAt: 0, running: false});
}
