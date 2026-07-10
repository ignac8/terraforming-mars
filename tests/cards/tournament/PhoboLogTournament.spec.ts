import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {PhoboLogTournament} from '../../../src/server/cards/tournament/PhoboLogTournament';
import {runAllActions} from '../../TestingUtils';

describe('PhoboLogTournament', () => {
  it('Should play', () => {
    const card = new PhoboLogTournament();
    const [game, player] = testGame(2);
    const initialTR = player.terraformRating;
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(28);
    expect(player.titanium).to.eq(10);
    expect(player.production.plants).to.eq(1);
    expect(player.terraformRating).to.eq(initialTR + 1);
    expect(player.getTitaniumValue()).to.eq(4);
  });
});
