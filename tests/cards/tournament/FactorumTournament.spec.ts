import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {FactorumTournament} from '../../../src/server/cards/tournament/FactorumTournament';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';

describe('FactorumTournament', () => {
  it('Should play', () => {
    const card = new FactorumTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(40);
    expect(player.production.steel).to.eq(1);
    expect(player.production.megacredits).to.eq(4);
  });

  it('Action increases energy production when player has no energy', () => {
    const card = new FactorumTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    player.megaCredits = 0;
    expect(card.canAct(player)).is.true;
    const option = cast(card.action(player), SelectOption);
    option.cb(undefined);
    expect(player.production.energy).to.eq(1);
  });
});
