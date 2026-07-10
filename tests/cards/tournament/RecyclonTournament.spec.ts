import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {RecyclonTournament} from '../../../src/server/cards/tournament/RecyclonTournament';
import {Tag} from '../../../src/common/cards/Tag';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {cast} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';

describe('RecyclonTournament', () => {
  it('Should play', () => {
    const card = new RecyclonTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(38);
    expect(player.production.megacredits).to.eq(-1);
    expect(player.production.plants).to.eq(1);
    expect(player.production.energy).to.eq(1);
    expect(player.production.heat).to.eq(1);
    expect(player.production.steel).to.eq(1);
    // Its own building tag adds the first microbe.
    expect(card.resourceCount).to.eq(1);
  });

  it('Triggers once per building tag', () => {
    const card = new RecyclonTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);
    expect(card.resourceCount).to.eq(1);

    player.playCard(fakeCard({tags: [Tag.BUILDING, Tag.BUILDING]}));
    // First tag: fewer than 2 microbes, so a microbe is added automatically.
    runAllActions(game);
    // Second tag: 2 microbes now, so the player chooses.
    const orOptions = cast(player.popWaitingFor(), OrOptions);
    orOptions.options[0].cb(undefined); // Remove 2 microbes, raise plant production.
    expect(card.resourceCount).to.eq(0);
    expect(player.production.plants).to.eq(2);
  });
});
