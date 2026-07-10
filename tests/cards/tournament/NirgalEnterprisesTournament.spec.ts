import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {NirgalEnterprisesTournament} from '../../../src/server/cards/tournament/NirgalEnterprisesTournament';
import {runAllActions} from '../../TestingUtils';

describe('NirgalEnterprisesTournament', () => {
  it('Should play', () => {
    const card = new NirgalEnterprisesTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(30);
    expect(player.production.energy).to.eq(1);
    expect(player.production.plants).to.eq(1);
    expect(player.production.steel).to.eq(1);
    expect(player.production.heat).to.eq(3);
    expect(player.heat).to.eq(3);
  });

  it('Milestones and awards are free', () => {
    const card = new NirgalEnterprisesTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.milestoneCost()).to.eq(0);
    expect(player.awardFundingCost()).to.eq(0);
  });
});
