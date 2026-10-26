import {expect} from 'chai';
import {Timer} from '../../src/common/Timer';
import {FakeClock} from './FakeClock';

describe('Timer', () => {
  let clock: FakeClock;
  let timer: Timer;

  beforeEach(() => {
    clock = new FakeClock();
    timer = Timer.newInstance(clock);
    // this lastStoppedAt is a bit of a gross mess.
    (Timer as any).lastStoppedAt = 0;
  });

  it('starts at 00:00', () => {
    expect(Timer.toString(timer.serialize())).eq('00:00');
  });

  it('changes running with start and stop', () => {
    expect(timer.serialize().running).eq(false);
    timer.start();
    expect(timer.serialize().running).eq(true);
    timer.stop();
    expect(timer.serialize().running).eq(false);
    timer.start();
    expect(timer.serialize().running).eq(true);
  });

  it('shows 00:01 after 1 sec', () => {
    timer.start(); // Skipping first action.
    timer.stop();
    expect(Timer.toString(timer.serialize(), clock)).eq('00:00');

    timer.start();
    expect(Timer.toString(timer.serialize(), clock)).eq('00:00');
    clock.millis += 1000;
    expect(Timer.toString(timer.serialize(), clock)).eq('00:01');
    timer.stop();
    expect(Timer.toString(timer.serialize(), clock)).eq('00:01');
  });

  it('does not count the first action, also while it runs', () => {
    // Another game's timer stopped a day ago.
    (Timer as any).lastStoppedAt = clock.millis - 24 * 3_600_000;
    timer.start();
    clock.millis += 1000;
    expect(timer.getElapsed()).eq(0);
    expect(Timer.toString(timer.serialize(), clock)).eq('00:00');
  });

  it('shows 1:00:01 after 3601 sec', () => {
    timer.start(); // Skipping first action
    timer.stop();

    timer.start();
    clock.millis += 3601 * 1000;
    expect(Timer.toString(timer.serialize(), clock)).eq('1:00:01');
    timer.stop();
    expect(Timer.toString(timer.serialize(), clock)).eq('1:00:01');
  });

  const toString = (sumElapsed: number) => Timer.toString({
    sumElapsed,
    startedAt: 0,
    running: false,
    afterFirstAction: true,
    lastStoppedAt: 0,
  });

  it('shows 3-digit hours', () => {
    expect(toString(((252 * 60 + 44) * 60 + 11) * 1000)).eq('252:44:11');
  });

  it('does not wrap hours after 31 days', () => {
    expect(toString(743 * 3_600_000)).eq('743:00:00');
    expect(toString(744 * 3_600_000)).eq('744:00:00');
    expect(toString(745 * 3_600_000 + 1000)).eq('745:00:01');
    expect(toString(1234 * 3_600_000)).eq('1234:00:00');
  });

  it('does not move the shared stop time backwards when loading another game', () => {
    const target = Timer.deserialize({
      sumElapsed: 0,
      startedAt: 0,
      running: false,
      afterFirstAction: true,
      lastStoppedAt: 5000,
    });

    Timer.deserialize({
      sumElapsed: 0,
      startedAt: 0,
      running: false,
      afterFirstAction: true,
      lastStoppedAt: 1000,
    });

    target.start();
    expect(target.serialize().startedAt).eq(5000);
  });

  it('rebate', () => {
    timer.start(); // Skipping first action
    timer.stop();

    timer.start();
    clock.millis += 3601 * 1000;
    timer.stop();
    expect(timer.getElapsed()).eq(3_601_000);
    timer.rebate(7_500);
    expect(timer.getElapsed()).eq(3_593_500);
    timer.rebate(10_000_000); // Doesn't go below zero.
    expect(timer.getElapsed()).eq(0);
  });

  it('pauses without counting the frozen time', () => {
    timer.resume();
    clock.millis = 1;
    timer.stop(); // The first action is not timed.
    clock.millis = 2;
    timer.resume();
    clock.millis = 12;
    timer.pause();
    clock.millis = 60;
    timer.resume();
    clock.millis = 70;
    expect(timer.getElapsed()).eq(20);
  });

  it('does not use up the untimed first action', () => {
    timer.resume();
    clock.millis = 10;
    timer.pause();
    expect(timer.countedElapsed()).eq(0);
    expect(timer.serialize().afterFirstAction).eq(false);
    timer.resume();
    clock.millis = 15;
    timer.stop();
    expect(timer.getElapsed()).eq(0);
  });

  it('leaves the shared last stop time alone', () => {
    const probe = Timer.newInstance(clock);
    clock.millis = 5;
    probe.stop();
    timer.resume();
    clock.millis = 12;
    timer.pause();
    clock.millis = 20;
    timer.resume();
    expect(timer.serialize().startedAt).eq(20);
    expect(timer.serialize().lastStoppedAt).eq(5);

    const other = Timer.newInstance(clock);
    other.start();
    expect(other.serialize().startedAt).eq(5);
  });

  it('counts the open interval only after the first action', () => {
    for (const run of [{first: true, expected: 0}, {first: false, expected: 7}]) {
      const t = Timer.newInstance(clock);
      clock.millis = 100;
      t.resume();
      if (!run.first) {
        t.stop();
        t.resume();
      }
      clock.millis += 7;
      expect(t.countedElapsed(), `first action pending: ${run.first}`).eq(run.expected);
    }
  });

  it('does nothing when pausing a timer that is not running', () => {
    timer.resume();
    timer.stop();
    clock.millis = 10;
    timer.resume();
    clock.millis = 15;
    timer.stop();
    const before = timer.serialize();
    expect(before.sumElapsed).eq(5);

    clock.millis = 40;
    timer.pause();
    expect(timer.serialize()).deep.eq(before);
    expect(timer.getElapsed()).eq(5);
  });

  it('drops the open interval when resuming a running timer', () => {
    timer.resume();
    timer.stop();
    clock.millis = 10;
    timer.resume();
    clock.millis = 17;
    timer.resume();
    clock.millis = 20;
    timer.pause();
    expect(timer.countedElapsed()).eq(3);
  });
});
