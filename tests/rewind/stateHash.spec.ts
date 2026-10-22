import {expect} from 'chai';
import {testGame} from '../TestingUtils';
import {sameState, stateHash} from '../../src/server/rewind/stateHash';

describe('stateHash', () => {
  it('ignores clocks, save ids and log timestamps', () => {
    const [game] = testGame(1);
    const a = game.serialize();
    const b = structuredClone(a);
    b.players[0].timer.sumElapsed += 5000;
    b.lastSaveId += 3;
    b.undoCount += 1;
    b.gameAge += 1;
    b.inputs = [];
    b.gameLog[0].timestamp += 1;
    expect(stateHash(b)).eq(stateHash(a));
    expect(sameState(a, b)).is.true;
    b.players[0].megaCredits += 1;
    expect(stateHash(b)).not.eq(stateHash(a));
    expect(sameState(a, b)).is.false;
  });

  it('does not depend on key order, and notices a missing log line', () => {
    const [game] = testGame(1);
    const a = game.serialize();
    const b = Object.fromEntries(Object.entries(structuredClone(a)).reverse()) as typeof a;
    expect(stateHash(b)).eq(stateHash(a));
    b.gameLog.pop();
    expect(stateHash(b)).not.eq(stateHash(a));
  });
});
