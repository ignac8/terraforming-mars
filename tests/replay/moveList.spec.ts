import {expect} from 'chai';
import {LogMessage} from '../../src/common/logs/LogMessage';
import {LogMessageType} from '../../src/common/logs/LogMessageType';
import {buildMoveList, SaveEntry} from '../../src/server/replay/moveList';
import {RewindRecord, visibleLog} from '../../src/server/rewind/RewindRecord';

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

    it('puts every line in exactly one move, in order', () => {
      for (const rewinds of [[first], runs[2].rewinds]) {
        const moves = buildMoveList(saves, rewinds, log, true);
        expect(moves.flatMap((m) => m.messages), JSON.stringify(rewinds)).deep.eq(log);
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
  });
});
