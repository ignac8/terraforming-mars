import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {CrediCorTournament} from '../../../src/server/cards/tournament/CrediCorTournament';
import {GiantIceAsteroid} from '../../../src/server/cards/base/GiantIceAsteroid';
import {Bushes} from '../../../src/server/cards/base/Bushes';
import {runAllActions} from '../../TestingUtils';

describe('CrediCorTournament', () => {
  it('Should play', () => {
    const card = new CrediCorTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(57);
    expect(player.production.steel).to.eq(1);
    expect(player.production.heat).to.eq(2);
    expect(player.heat).to.eq(2);
  });

  it('Pays back big purchases', () => {
    const card = new CrediCorTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    player.megaCredits = 0;
    player.playCard(new GiantIceAsteroid());
    expect(player.megaCredits).to.eq(4);
    player.playCard(new Bushes());
    expect(player.megaCredits).to.eq(4);
  });
});
