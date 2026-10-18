import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {Game} from '@/server/Game';
import {UnderworldExpansion} from '@/server/underworld/UnderworldExpansion';
import {AresHandler} from '@/server/ares/AresHandler';
import {TileType} from '@/common/TileType';

describe('probe serialization on Amazonis', () => {
  it('BUG: board with underground tokens, excavators, hazards roundtrips', () => {
    const [game, player] = testGame(2, {
      boardName: BoardName.AMAZONIS_PLANITIA,
      underworldExpansion: true,
      aresExtension: true,
      aresHazards: true,
    });
    const s1 = game.board.getSpaceOrThrow('33'); // E1 volcanic
    UnderworldExpansion.excavate(player, s1);
    const s2 = game.board.getSpaceOrThrow('70');
    UnderworldExpansion.identify(game, s2, player);
    const serialized = game.serialize();
    const game2 = Game.deserialize(JSON.parse(JSON.stringify(serialized)));
    expect(game2.gameOptions.boardName).eq(BoardName.AMAZONIS_PLANITIA);
    expect(game2.board.spaces.length).eq(game.board.spaces.length);
    for (const sp of game.board.spaces) {
      const sp2 = game2.board.getSpaceOrThrow(sp.id);
      expect(sp2.undergroundResources, sp.id).eq(sp.undergroundResources);
      expect(sp2.excavator?.id, sp.id).eq(sp.excavator?.id);
      expect(sp2.volcanic, sp.id).eq(sp.volcanic);
      expect(sp2.tile, sp.id).deep.eq(sp.tile);
      expect(sp2.bonus, sp.id).deep.eq(sp.bonus);
      expect(sp2.edge, sp.id).eq(sp.edge);
      expect(sp2.spaceType, sp.id).eq(sp.spaceType);
    }
    expect(game2.underworldData.tokens).deep.eq(game.underworldData.tokens);
    expect(game2.board.spaces.filter(AresHandler.hasHazardTile).length).eq(game.board.spaces.filter(AresHandler.hasHazardTile).length);
    expect(game2.board.spaces.filter((s) => s.tile?.tileType === TileType.DUST_STORM_MILD).length).greaterThan(0);
    expect(game2.aresData).deep.eq(game.aresData);
    expect(game2.max).deep.eq(game.max);
  });
});
