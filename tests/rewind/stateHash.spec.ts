import {expect} from 'chai';
import {testGame} from '../TestingUtils';
import {sameState, stateHash} from '../../src/server/rewind/stateHash';

describe('stateHash', () => {
  it('ignores clocks, save ids, log timestamps and seat passwords', () => {
    const [game] = testGame(1);
    const a = game.serialize();
    const b = structuredClone(a);
    b.players[0].timer.sumElapsed += 5000;
    b.lastSaveId += 3;
    b.undoCount += 1;
    b.gameAge += 1;
    b.inputs = [];
    b.gameLog[0].timestamp += 1;
    b.judgePassword = 'judge';
    b.players[0].password = 'player';
    expect(stateHash(b)).eq(stateHash(a));
    expect(sameState(a, b)).is.true;
    b.players[0].megaCredits += 1;
    expect(stateHash(b)).not.eq(stateHash(a));
    expect(sameState(a, b)).is.false;
  });

  it('ignores the table state', () => {
    const [game, player] = testGame(2);
    const a = game.serialize();
    const b = structuredClone(a);
    b.frozen = true;
    b.rewindVote = {id: 1, requester: player.id, saveId: 1, moveNumber: 1, generation: 1, cards: 'same', yes: [player.id], status: 'open', expiresAt: 1};
    b.rewindRequestLimits = {generation: 1, players: [player.id]};
    expect(stateHash(b)).eq(stateHash(a));
    expect(sameState(a, b)).is.true;
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
