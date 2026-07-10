import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {InterplanetaryCinematicsTournament} from '../../../src/server/cards/tournament/InterplanetaryCinematicsTournament';
import {InventionContest} from '../../../src/server/cards/base/InventionContest';
import {runAllActions} from '../../TestingUtils';

describe('InterplanetaryCinematicsTournament', () => {
  it('Should play', () => {
    const card = new InterplanetaryCinematicsTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(30);
    expect(player.steel).to.eq(20);
    expect(player.plants).to.eq(2);
    expect(player.production.energy).to.eq(1);
    expect(player.production.plants).to.eq(1);
  });

  it('Pays 2 M€ for events', () => {
    const card = new InterplanetaryCinematicsTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    player.megaCredits = 0;
    player.playCard(new InventionContest());
    runAllActions(game);
    expect(player.megaCredits).to.eq(2);
  });
});
