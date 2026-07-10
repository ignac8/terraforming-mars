import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {EcotecTournament} from '../../../src/server/cards/tournament/EcotecTournament';
import {runAllActions} from '../../TestingUtils';

describe('EcotecTournament', () => {
  it('Should play, gaining plants for its own bio tags', () => {
    const card = new EcotecTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(48);
    expect(player.production.plants).to.eq(1);
    expect(player.production.energy).to.eq(1);
    expect(player.production.steel).to.eq(1);
    // Microbe + plant tag on the corporation itself, no microbe cards in play.
    expect(player.plants).to.eq(2);
  });
});
