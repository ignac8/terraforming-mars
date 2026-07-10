import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {EcoLineTournament} from '../../../src/server/cards/tournament/EcoLineTournament';
import {runAllActions} from '../../TestingUtils';

describe('EcoLineTournament', () => {
  it('Should play', () => {
    const card = new EcoLineTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(36);
    expect(player.production.plants).to.eq(2);
    expect(player.production.megacredits).to.eq(1);
    expect(player.production.steel).to.eq(1);
    expect(player.production.titanium).to.eq(1);
    expect(player.plants).to.eq(3);
    expect(player.plantsNeededForGreenery).to.eq(7);
  });
});
