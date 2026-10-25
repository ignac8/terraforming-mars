import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {activeRewinds, isAbandonedSave, isHiddenLogIndex, RewindRecord, visibleLog} from '../../src/server/rewind/RewindRecord';
import {testGame} from '../TestGame';
import {everyHistory, RewindHistory} from './RewindHistory';

describe('RewindRecord', () => {
  it('round-trips rewind records', () => {
    const [game] = testGame(1);
    game.rewinds = [{saveId: 4, restoredSaveId: 2, logStart: 4, logEnd: 6}];
    expect(Game.deserialize(game.serialize()).rewinds).deep.eq(game.rewinds);
    game.rewinds = [];
    expect(game.serialize()).not.have.property('rewinds');
  });

  it('brings an undone stretch back and keeps the played line whole across three rewinds', () => {
    // Saves 0 to 9 are played.
    const history = new RewindHistory(9);
    const length = (saveId: number) => history.saves[saveId].logLength;
    const range = (from: number, to: number) => Array.from({length: to - from}, (_, i) => from + i);
    const check = (step: string, active: Array<RewindRecord>, saves: Array<number>, hidden: Array<number>) => {
      const {rewinds, log} = history;
      expect(activeRewinds(rewinds), step).deep.eq(active);
      expect(range(0, history.newest + 1).filter((saveId) => !isAbandonedSave(saveId, rewinds)), step).deep.eq(saves);
      expect(range(0, log.length).filter((idx) => isHiddenLogIndex(idx, rewinds)), step).deep.eq(hidden);
      expect(visibleLog(log, rewinds), step).deep.eq(log.filter((_, idx) => !hidden.includes(idx)));
    };

    // A restores save 4 and writes save 10. Saves 11 and 12 are played.
    const a = history.rewind(4);
    history.move().move();
    check('A', [a], [0, 1, 2, 3, 10, 11, 12], range(length(4), a.logEnd));

    // B restores save 7, inside A's stretch, and writes save 13. Save 14 is played. A's marker is hidden with the
    // moves that followed save 7.
    const b = history.rewind(7);
    history.move();
    check('B', [b], [0, 1, 2, 3, 4, 5, 6, 13, 14], range(length(7), b.logEnd));
    expect(b.logEnd).gt(a.logEnd);

    // C restores save 11, inside B's stretch on A's line, and writes save 15. A's line comes back up to save 11, and
    // B's marker is hidden.
    const c = history.rewind(11);
    check('C', [a, c], [0, 1, 2, 3, 10, 15], [...range(length(4), a.logEnd), ...range(length(11), c.logEnd)]);
    expect(c.logEnd).gt(b.logEnd);
  });

  it('answers as before when no rewind brings an undone stretch back', () => {
    const union = (rewinds: ReadonlyArray<RewindRecord>) => ({
      abandoned: (saveId: number) => rewinds.some((r) => saveId >= r.restoredSaveId && saveId < r.saveId),
      hidden: (idx: number) => rewinds.some((r) => idx >= r.logStart && idx < r.logEnd),
    });
    // Among them a single rewind, one to the save of the rewind before, and one to a save before an earlier rewind's.
    let checked = 0;
    for (const count of [1, 2, 3]) {
      for (const {history, targets} of everyHistory(5, count)) {
        if (!history.everyTargetVisible) {
          continue;
        }
        checked++;
        const {rewinds, log} = history;
        const reference = union(rewinds);
        for (let saveId = 0; saveId <= history.newest; saveId++) {
          expect(isAbandonedSave(saveId, rewinds), `${targets} save ${saveId}`).eq(reference.abandoned(saveId));
        }
        for (let idx = 0; idx < log.length; idx++) {
          expect(isHiddenLogIndex(idx, rewinds), `${targets} line ${idx}`).eq(reference.hidden(idx));
        }
      }
    }
    expect(checked).gt(100);
  });
});
