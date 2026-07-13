import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {SagittaFrontierServicesTournament} from '../../../src/server/cards/tournament/SagittaFrontierServicesTournament';
import {fakeCard, runAllActions} from '../../TestingUtils';

describe('SagittaFrontierServicesTournament', () => {
  it('Should play', () => {
    const card = new SagittaFrontierServicesTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.production.energy).to.eq(1);
    expect(player.production.plants).to.eq(1);
    expect(player.production.megacredits).to.eq(4);
    // 35 starting M€. Unlike the original, playing the corporation itself pays nothing extra.
    expect(player.megaCredits).to.eq(35);
    // Draws a card with no tag.
    expect(player.cardsInHand).has.length(1);
    expect(player.cardsInHand[0].tags).is.empty;
  });

  it('Still pays for other no-tag cards', () => {
    const card = new SagittaFrontierServicesTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);
    expect(player.megaCredits).to.eq(35);

    card.onCardPlayed(player, fakeCard({tags: []}));
    runAllActions(game);
    expect(player.megaCredits).to.eq(39);
  });
});
