import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {PalladinShippingTournament} from '../../../src/server/cards/tournament/PalladinShippingTournament';
import {SolarWindPower} from '../../../src/server/cards/base/SolarWindPower';
import {Comet} from '../../../src/server/cards/base/Comet';
import {runAllActions} from '../../TestingUtils';

describe('PalladinShippingTournament', () => {
  it('Should play', () => {
    const card = new PalladinShippingTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(36);
    expect(player.titanium).to.eq(5);
    expect(player.production.megacredits).to.eq(1);
    expect(player.cardsInHand).has.length(3);
  });

  it('Gains titanium for space events and raises temperature by action', () => {
    const card = new PalladinShippingTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    card.onCardPlayed(player, new Comet());
    expect(player.titanium).to.eq(6);
    // Non-event space card does not trigger.
    card.onCardPlayed(player, new SolarWindPower());
    expect(player.titanium).to.eq(6);

    const startingTemperature = game.getTemperature();
    expect(card.canAct(player)).is.true;
    card.action(player);
    runAllActions(game);
    expect(player.titanium).to.eq(4);
    expect(game.getTemperature()).to.eq(startingTemperature + 2);
  });
});
