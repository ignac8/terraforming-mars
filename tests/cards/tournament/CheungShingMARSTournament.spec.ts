import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {CheungShingMARSTournament} from '../../../src/server/cards/tournament/CheungShingMARSTournament';
import {Mine} from '../../../src/server/cards/base/Mine';
import {runAllActions} from '../../TestingUtils';

describe('CheungShingMARSTournament', () => {
  it('Should play', () => {
    const card = new CheungShingMARSTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(65);
    expect(player.production.megacredits).to.eq(3);
    expect(player.getCardCost(new Mine())).to.eq(4 - 2);
  });
});
