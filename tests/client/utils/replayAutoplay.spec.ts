import {expect} from 'chai';
import {autoplayDelay, FIXED_STEP_MS, REAL_TIME_MAX_MS, REAL_TIME_MIN_MS} from '@/client/utils/replayAutoplay';
import {ReplayMove} from '@/common/replay/ReplayModel';
import {LogMessage} from '@/common/logs/LogMessage';

function atTimes(...times: Array<number | undefined>): Array<ReplayMove> {
  return times.map((at, i) => ({saveId: i + 1, messages: [], ...(at === undefined ? {} : {at})}));
}

function loggedAt(...times: Array<number | undefined>): Array<ReplayMove> {
  return times.map((timestamp, i) => ({
    saveId: i + 1,
    messages: timestamp === undefined ? [] : [{message: 'line', data: [], timestamp} as LogMessage],
  }));
}

describe('autoplayDelay', () => {
  it('waits the same time for every move in fixed mode, and divides it by the speed', () => {
    const moves = atTimes(1000, 5000, 5100);
    expect([0, 1, 2].map((i) => autoplayDelay(moves, i, 1, false))).deep.eq([FIXED_STEP_MS, FIXED_STEP_MS, FIXED_STEP_MS]);
    expect(autoplayDelay(moves, 1, 4, false)).eq(FIXED_STEP_MS / 4);
    expect(autoplayDelay(moves, 1, 0.1, false)).eq(FIXED_STEP_MS * 10);
  });

  it('waits as long as the player took in real time, from the answer before to the one that leaves the move', () => {
    const moves = atTimes(1000, 4000, 4800);
    expect(autoplayDelay(moves, 1, 1, true)).eq(3000);
    expect(autoplayDelay(moves, 2, 1, true)).eq(800);
  });

  it('divides the real wait by the speed', () => {
    const moves = atTimes(1000, 5000);
    expect(autoplayDelay(moves, 1, 2, true)).eq(2000);
    expect(autoplayDelay(moves, 1, 0.5, true)).eq(8000);
  });

  it('keeps the real wait between the shortest and the longest', () => {
    const moves = atTimes(0, 10, 1_000_000, 1_008_000, 1_008_800);
    expect(autoplayDelay(moves, 1, 1, true)).eq(REAL_TIME_MIN_MS);
    expect(autoplayDelay(moves, 2, 1, true)).eq(REAL_TIME_MAX_MS);
    // The speed scales the wait before it is kept within the bounds.
    expect(autoplayDelay(moves, 3, 4, true)).eq(2000);
    expect(autoplayDelay(moves, 3, 0.1, true)).eq(REAL_TIME_MAX_MS);
    expect(autoplayDelay(moves, 4, 4, true)).eq(REAL_TIME_MIN_MS);
  });

  it('keeps an answer that seems to come before the one it follows to the shortest wait', () => {
    expect(autoplayDelay(atTimes(5000, 1000), 1, 1, true)).eq(REAL_TIME_MIN_MS);
  });

  it('waits the fixed time on the first move, which no answer led to', () => {
    expect(autoplayDelay(atTimes(1000, 4000), 0, 1, true)).eq(FIXED_STEP_MS);
    expect(autoplayDelay(atTimes(1000, 4000), 0, 2, true)).eq(FIXED_STEP_MS / 2);
  });

  it('reads the first log line of a move when it has no answer time', () => {
    const moves = loggedAt(1000, 3500, 4000);
    expect(autoplayDelay(moves, 1, 1, true)).eq(2500);
    expect(autoplayDelay(moves, 2, 1, true)).eq(500);
  });

  it('reads the log line only for the side that has no answer time', () => {
    const moves: Array<ReplayMove> = [{saveId: 1, messages: [], at: 1000}, {saveId: 2, messages: [{message: 'line', data: [], timestamp: 3000} as LogMessage]}];
    expect(autoplayDelay(moves, 1, 1, true)).eq(2000);
  });

  it('waits the fixed time when either side has no time at all', () => {
    expect(autoplayDelay(atTimes(1000, undefined), 1, 1, true)).eq(FIXED_STEP_MS);
    expect(autoplayDelay(atTimes(undefined, 4000), 1, 1, true)).eq(FIXED_STEP_MS);
    expect(autoplayDelay(loggedAt(1000, undefined, 3000), 2, 2, true)).eq(FIXED_STEP_MS / 2);
  });
});
