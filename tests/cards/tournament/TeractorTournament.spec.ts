import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TeractorTournament} from '../../../src/server/cards/tournament/TeractorTournament';
import {LunaGovernor} from '../../../src/server/cards/colonies/LunaGovernor';
import {runAllActions} from '../../TestingUtils';

describe('TeractorTournament', () => {
  it('Should play', () => {
    const card = new TeractorTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(60);
    expect(player.production.plants).to.eq(1);
    expect(player.cardsInHand).has.length(3);
  });

  it('Discounts Earth tags', () => {
    const card = new TeractorTournament();
    const [/* game */, player] = testGame(2);

    expect(card.getCardDiscount(player, new LunaGovernor())).to.eq(6);
  });
});
