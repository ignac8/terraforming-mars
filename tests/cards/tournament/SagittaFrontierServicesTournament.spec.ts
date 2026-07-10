import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {SagittaFrontierServicesTournament} from '../../../src/server/cards/tournament/SagittaFrontierServicesTournament';
import {runAllActions} from '../../TestingUtils';

describe('SagittaFrontierServicesTournament', () => {
  it('Should play', () => {
    const card = new SagittaFrontierServicesTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.production.energy).to.eq(1);
    expect(player.production.plants).to.eq(1);
    expect(player.production.megacredits).to.eq(4);
    // 31 starting + 4 for playing itself, a card with no tags.
    expect(player.megaCredits).to.eq(35);
    // Draws a card with no tag.
    expect(player.cardsInHand).has.length(1);
    expect(player.cardsInHand[0].tags).is.empty;
  });
});
