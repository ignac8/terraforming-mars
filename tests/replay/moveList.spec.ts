import {expect} from 'chai';
import {LogMessage} from '../../src/common/logs/LogMessage';
import {LogMessageType} from '../../src/common/logs/LogMessageType';
import {ReplayMove} from '../../src/common/replay/ReplayModel';
import {buildMoveList, SaveEntry} from '../../src/server/replay/moveList';
import {activeRewinds, isAbandonedSave, isHiddenLogIndex, RewindRecord, visibleLog} from '../../src/server/rewind/RewindRecord';
import {everyHistory, RewindHistory} from '../rewind/RewindHistory';

describe('buildMoveList', () => {
  const log = Array.from({length: 12}, (_, i) => new LogMessage(LogMessageType.DEFAULT, `line ${i}`, []));
  const saves: Array<SaveEntry> = [0, 2, 4, 6, 7, 9, 11].map((logLength, saveId) => ({saveId, logLength}));
  const first: RewindRecord = {saveId: 4, restoredSaveId: 2, logStart: 4, logEnd: 6};

  const runs: Array<{rewinds: Array<RewindRecord>, saveIds: Array<number>}> = [
    {rewinds: [], saveIds: [0, 1, 2, 3, 4, 5, 6]},
    {rewinds: [first], saveIds: [0, 1, 4, 5, 6]},
    // A second rewind, to a move before the first, hides the first one's marker too.
    {rewinds: [first, {saveId: 6, restoredSaveId: 1, logStart: 2, logEnd: 10}], saveIds: [0, 6]},
    // A second rewind, to the save the first one wrote, keeps the first one's marker.
    {rewinds: [first, {saveId: 6, restoredSaveId: 4, logStart: 7, logEnd: 10}], saveIds: [0, 1, 6]},
  ];

  for (const run of runs) {
    it(`lists saves ${run.saveIds}`, () => {
      const moves = buildMoveList(saves, run.rewinds, log);
      expect(moves.map((m) => m.saveId)).deep.eq(run.saveIds);
    });
  }

  it('puts every visible line in exactly one move, in order', () => {
    for (const run of runs) {
      const moves = buildMoveList(saves, run.rewinds, log);
      expect(moves.flatMap((m) => m.messages)).deep.eq(visibleLog(log, run.rewinds));
    }
  });

  it('gives the save a rewind wrote its marker line', () => {
    const moves = buildMoveList(saves, [first], log);
    expect(moves[1].messages).deep.eq(log.slice(2, 4));
    expect(moves[2].messages).deep.eq(log.slice(6, 9));
  });

  it('keeps the first marker with the save of a repeated rewind', () => {
    const moves = buildMoveList(saves, runs[3].rewinds, log);
    expect(moves[2].messages).deep.eq([log[6], log[10], log[11]]);
  });

  describe('with the undone moves shown', () => {
    it('lists the saves of the abandoned line in order, marked undone', () => {
      const moves = buildMoveList(saves, [first], log, true);
      // Save 3 holds no line of its own: the rewind ended at its log length, and the hidden lines are save 2's.
      expect(moves.map((m) => [m.saveId, m.undone])).deep.eq([[0, undefined], [1, undefined], [2, true], [4, undefined], [5, undefined], [6, undefined]]);
    });

    it('ends the last abandoned save where the rewind did, and gives the marker to the rewind\'s save', () => {
      const moves = buildMoveList(saves, [first], log, true);
      expect(moves[2].messages).deep.eq(log.slice(4, 6));
      expect(moves[3].messages).deep.eq(log.slice(6, 9));
      expect(moves[4].messages).deep.eq(log.slice(9, 11));
    });

    it('puts every line in exactly one move, in order unless a later rewind\'s save took an earlier marker', () => {
      for (const [rewinds, inOrder] of [[[first], true], [runs[2].rewinds, true], [runs[3].rewinds, false]] as const) {
        const indexes = buildMoveList(saves, rewinds, log, true).flatMap((m) => m.messages).map((m) => log.indexOf(m));
        const all = log.map((_, idx) => idx);
        expect([...indexes].sort((a, b) => a - b), JSON.stringify(rewinds)).deep.eq(all);
        expect(indexes.join() === all.join(), JSON.stringify(rewinds)).eq(inOrder);
      }
    });

    it('marks the saves of an earlier rewind\'s line too when a later rewind goes further back', () => {
      const moves = buildMoveList(saves, runs[2].rewinds, log, true);
      expect(moves.filter((m) => m.undone).map((m) => m.saveId)).deep.eq([1, 2, 4, 5]);
    });

    it('marks nothing without the switch', () => {
      for (const run of runs) {
        expect(buildMoveList(saves, run.rewinds, log).some((m) => m.undone !== undefined)).is.false;
      }
    });

    it('leaves the marker of a rewind whose save a later rewind restored to the later rewind\'s save alone', () => {
      // Save 4, the first rewind's, is undone. Its marker, line 6, still shows: the second rewind restored it.
      const moves = buildMoveList(saves, runs[3].rewinds, log, true);
      expect(moves.filter((m) => m.messages.includes(log[6])).map((m) => m.saveId)).deep.eq([6]);
      expect(moves.find((m) => m.saveId === 4)?.messages).deep.eq([log[7], log[8]]);
    });
  });

  describe('after rewinds that bring undone moves back', () => {
    // The save a marker belongs to: its rewind's own, or the save of a later rewind that restored that one.
    function holdsMarker(saveId: number, record: RewindRecord, rewinds: ReadonlyArray<RewindRecord>): boolean {
      let r = rewinds.find((x) => x.saveId === saveId);
      while (r !== undefined && r !== record) {
        const restored = r.restoredSaveId;
        r = rewinds.find((x) => x.saveId === restored);
      }
      return r === record;
    }

    function checkInvariants(history: RewindHistory, label: string): Array<ReplayMove> {
      const {saves, rewinds, log} = history;
      const active = activeRewinds(rewinds);
      const indexOf = (m: LogMessage) => log.indexOf(m);

      // The visible saves and lines are the ones that were visible when the save now restored was the newest.
      for (let saveId = 0; saveId <= history.newest; saveId++) {
        expect(isAbandonedSave(saveId, rewinds), `${label} save ${saveId}`).eq(!history.visibleSaves.has(saveId));
      }
      for (let idx = 0; idx < log.length; idx++) {
        expect(isHiddenLogIndex(idx, rewinds), `${label} line ${idx}`).eq(!history.visibleLines.has(idx));
      }

      // The visible saves are the played line: each follows the one before, or is the save of an active rewind that
      // stands for the save that would follow, itself or through the rewind whose save it restored.
      const visible = saves.map((s) => s.saveId).filter((saveId) => !isAbandonedSave(saveId, rewinds));
      for (let i = 1; i < visible.length; i++) {
        const [p, q] = [visible[i - 1], visible[i]];
        let standsFor = q;
        for (let r = active.find((x) => x.saveId === q); r !== undefined; r = active.find((x) => x.saveId === standsFor)) {
          standsFor = r.restoredSaveId;
        }
        expect(q === p + 1 || standsFor === p + 1, `${label} ${p} then ${q}`).is.true;
      }

      // Every visible line is in exactly one move, in order.
      const moves = buildMoveList(saves, rewinds, log);
      expect(moves.flatMap((m) => m.messages), label).deep.eq(visibleLog(log, rewinds));

      // A marker shows exactly when its rewind is active, with that rewind's save or a later rewind's that restored it.
      for (const record of rewinds) {
        const holders = moves.filter((m) => m.messages.includes(log[record.logEnd]));
        expect(holders.length, `${label} marker of ${record.saveId}`).eq(active.includes(record) ? 1 : 0);
        for (const holder of holders) {
          expect(holdsMarker(holder.saveId, record, rewinds), `${label} marker of ${record.saveId} in ${holder.saveId}`).is.true;
        }
      }

      // The switch only adds the undone saves, with lines that are hidden, and every line is then in exactly one move.
      const all = buildMoveList(saves, rewinds, log, true);
      expect(all.filter((m) => m.undone !== true), label).deep.eq(moves);
      for (const move of all.filter((m) => m.undone === true)) {
        expect(isAbandonedSave(move.saveId, rewinds), `${label} undone ${move.saveId}`).is.true;
        expect(move.messages.every((m) => isHiddenLogIndex(indexOf(m), rewinds)), `${label} undone ${move.saveId}`).is.true;
      }
      expect(all.flatMap((m) => m.messages).map(indexOf).sort((a, b) => a - b), label).deep.eq(log.map((_, idx) => idx));
      return moves;
    }

    it('keeps the played line whole when a rewind brings back a stretch an earlier rewind undid, and again after a third', () => {
      // Saves 0 to 9; A restores save 4 and writes save 10; saves 11 and 12; B restores save 7, inside A's stretch, and
      // writes save 13; save 14; C restores save 11, inside B's stretch on A's line, and writes save 15.
      const history = new RewindHistory(9);
      history.rewind(4);
      history.move().move();
      expect(checkInvariants(history, 'A').map((m) => m.saveId)).deep.eq([0, 1, 2, 3, 10, 11, 12]);
      history.rewind(7);
      history.move();
      expect(checkInvariants(history, 'B').map((m) => m.saveId)).deep.eq([0, 1, 2, 3, 4, 5, 6, 13, 14]);
      history.rewind(11);
      expect(checkInvariants(history, 'C').map((m) => m.saveId)).deep.eq([0, 1, 2, 3, 10, 15]);
    });

    it('keeps the played line whole after any three rewinds', () => {
      let bringsBack = 0;
      for (const {history, targets} of everyHistory(6, 3)) {
        checkInvariants(history, String(targets));
        if (!history.everyTargetVisible) {
          bringsBack++;
        }
      }
      expect(bringsBack).gt(100);
    });
  });
});
