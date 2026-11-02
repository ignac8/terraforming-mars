import {expect} from 'chai';
import {isTableLocked, withTableLock} from '../../src/server/rewind/tableLock';
import {RouteError} from '../../src/server/routes/RouteError';
import {GameId} from '../../src/common/Types';

describe('tableLock', () => {
  it('runs one table operation per game at a time', async () => {
    const game = 'g-table-lock' as GameId;
    const other = 'g-table-lock-other' as GameId;
    let release = () => {};
    const first = withTableLock(game, () => new Promise<string>((resolve) => release = () => resolve('first')));
    expect(isTableLocked(game)).is.true;

    let refused: unknown;
    let ran = false;
    await withTableLock(game, async () => {
      ran = true;
    }).catch((e) => refused = e);
    expect(ran).is.false;
    expect(refused).instanceOf(RouteError);
    expect((refused as RouteError).detail).eq('A rewind is already running.');
    expect(await withTableLock(other, async () => 'other')).eq('other');
    expect(isTableLocked(other)).is.false;

    release();
    expect(await first).eq('first');
    expect(isTableLocked(game)).is.false;

    // A failed operation frees the table too.
    await withTableLock(game, () => Promise.reject(new Error('failed'))).catch(() => {});
    expect(isTableLocked(game)).is.false;
  });
});
