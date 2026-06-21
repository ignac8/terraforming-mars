import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {expect} from 'chai';
import {AmazonisBigBoard} from '../../src/server/boards/AmazonisBigBoard';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SeededRandom} from '../../src/common/utils/Random';

describe('AmazonisBigBoard collision', () => {
  // The big board numbers its 91 mars land spaces, and the off-board expansion colonies use fixed
  // reserved ids ('69'..'78') that fall inside that range. With the mars spaces prefixed 'a', they
  // no longer collide with the colony ids.
  // Venera Base is only reserved when pathfinders + turmoil + venus are all in play, so turmoil is
  // enabled too to exercise the full set of colliding reserved ids.
  const board = AmazonisBigBoard.newInstance({
    ...DEFAULT_GAME_OPTIONS,
    pathfindersExpansion: true,
    turmoilExtension: true,
    venusNextExtension: true,
    expansions: {
      ...DEFAULT_GAME_OPTIONS.expansions,
      venus: true,
      pathfinders: true,
      promo: true,
      turmoil: true,
    },
  }, new SeededRandom(0));

  it('every space id is unique', () => {
    const ids = board.spaces.map((s) => s.id);
    expect(new Set(ids).size).eq(ids.length);
  });

  it('expansion colony spaces still exist by their reserved ids', () => {
    const lunaMetropolis = board.getSpaceOrThrow(SpaceName.LUNA_METROPOLIS);
    expect(lunaMetropolis.id).eq('70');
    expect(lunaMetropolis.spaceType).eq(SpaceType.COLONY);

    const veneraBase = board.getSpaceOrThrow(SpaceName.VENERA_BASE);
    expect(veneraBase.id).eq('78');
    expect(veneraBase.spaceType).eq(SpaceType.COLONY);
  });

  it('the mars space sharing a colony number lives under the prefixed id', () => {
    const marsSpace = board.getSpaceOrThrow('a70');
    expect(marsSpace.spaceType).does.not.eq(SpaceType.COLONY);
  });
});
