import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {ManutechTournament} from '../../../src/server/cards/tournament/ManutechTournament';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cast} from '../../../src/common/utils/utils';
import {TileType} from '../../../src/common/TileType';
import {runAllActions} from '../../TestingUtils';
import {Phase} from '../../../src/common/Phase';

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

  // Corporations are played at setup, where every player resolves their own choices at once. The
  // city goes on the shared board, so a second owner places only after the first has.
  it('A second owner places their city only after the first has', () => {
    const [game, p1, p2] = testGame(2, {tournamentExpansion: true});
    game.phase = Phase.RESEARCH;

    p1.playCorporationCard(new ManutechTournament());
    p2.playCorporationCard(new ManutechTournament());

    const first = cast(p1.getWaitingFor(), SelectSpace);
    expect(p2.getWaitingFor()).is.undefined;
    p1.process({type: 'space', spaceId: first.spaces[0].id});

    const second = cast(p2.getWaitingFor(), SelectSpace);
    expect(second.spaces).does.not.include(first.spaces[0]);
    p2.process({type: 'space', spaceId: second.spaces[0].id});

    expect(game.board.getCities()).has.length(2);
    expect(game.phase).eq(Phase.ACTION);
  });
});
