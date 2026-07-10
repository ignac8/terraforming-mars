import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {InventrixTournament} from '../../../src/server/cards/tournament/InventrixTournament';
import {runAllActions} from '../../TestingUtils';

describe('InventrixTournament', () => {
  it('Should play', () => {
    const card = new InventrixTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(45);
    expect(player.production.steel).to.eq(2);
    expect(player.steel).to.eq(4);
  });
});
