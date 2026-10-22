import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {testGame} from '../TestGame';

describe('RewindRecord', () => {
  it('round-trips rewind records', () => {
    const [game] = testGame(1);
    game.rewinds = [{saveId: 4, restoredSaveId: 2, logStart: 4, logEnd: 6}];
    expect(Game.deserialize(game.serialize()).rewinds).deep.eq(game.rewinds);
    game.rewinds = [];
    expect(game.serialize()).not.have.property('rewinds');
  });
});
