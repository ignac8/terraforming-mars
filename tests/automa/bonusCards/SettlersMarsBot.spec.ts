import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {SpaceType} from '@/common/boards/SpaceType';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';

describe('SettlersMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('puts a player marker on a free land space instead of a tile', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B22_SETTLERS));

    expect(marsBot.markerSpaceIds).has.length(1);
    const space = game.board.getSpaceOrThrow(marsBot.markerSpaceIds[0]);
    expect(space.spaceType).to.eq(SpaceType.LAND);
    expect(space.tile).is.undefined;
    expect(space.player).to.eq(marsBot.player);
    expect(game.board.getGreeneries(marsBot.player)).is.empty;
    expect(game.board.getAvailableSpacesOnLand(human)).does.not.include(space);
  });

  it('prefers the space next to the most ocean-reserved spaces before the random tiebreak', () => {
    const {marsBot} = createAutomaGame();
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B22_SETTLERS));

    // Of the empty Tharsis spaces with two bonus icons, only these two touch three ocean-reserved spaces.
    expect(marsBot.markerSpaceIds[0]).to.be.oneOf(['35', '36']);
  });

  it('never picks a space that already has a marker', () => {
    const {marsBot} = createAutomaGame();
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B22_SETTLERS));
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B22_SETTLERS));
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B22_SETTLERS));

    expect(marsBot.markerSpaceIds.slice(0, 2)).to.have.members(['35', '36']);
    expect(new Set(marsBot.markerSpaceIds).size).to.eq(3);
  });
});
