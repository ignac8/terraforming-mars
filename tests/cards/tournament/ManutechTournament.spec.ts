import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {ManutechTournament} from '../../../src/server/cards/tournament/ManutechTournament';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cast} from '../../../src/common/utils/utils';
import {TileType} from '../../../src/common/TileType';
import {runAllActions} from '../../TestingUtils';

describe('ManutechTournament', () => {
  it('Should play, gaining resources for its own production and placing a city', () => {
    const card = new ManutechTournament();
    const [game, player] = testGame(2);
    player.playCorporationCard(card);
    runAllActions(game);

    expect(player.megaCredits).to.eq(35);
    expect(player.production.steel).to.eq(1);
    expect(player.production.plants).to.eq(1);
    // Self-trigger: gains the resources of its own production increases.
    expect(player.steel).to.eq(1);
    expect(player.plants).to.eq(1);

    const selectSpace = cast(player.popWaitingFor(), SelectSpace);
    const space = selectSpace.spaces[0];
    selectSpace.cb(space);
    expect(space.tile?.tileType).to.eq(TileType.CITY);
    expect(space.player?.id).to.eq(player.id);
  });
});
