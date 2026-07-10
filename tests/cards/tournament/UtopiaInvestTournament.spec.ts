import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {UtopiaInvestTournament} from '../../../src/server/cards/tournament/UtopiaInvestTournament';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';

describe('UtopiaInvestTournament', () => {
  it('Should play', () => {
    const card = new UtopiaInvestTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(40);
    expect(player.production.steel).to.eq(1);
    expect(player.production.titanium).to.eq(1);
    expect(player.production.energy).to.eq(2);
    expect(player.steel).to.eq(4);
  });

  it('Action trades production for resources', () => {
    const card = new UtopiaInvestTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    const orOptions = cast(card.action(player), OrOptions);
    const reduceSteel = orOptions.options.find((option) => option.title === 'Decrease steel production');
    reduceSteel!.cb(undefined);
    expect(player.production.steel).to.eq(0);
    expect(player.steel).to.eq(4 + 4);
  });
});
