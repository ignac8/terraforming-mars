import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {TileType} from '@/common/TileType';
import {testGame} from '../../TestGame';
import {addOcean, setOxygenLevel, setTemperature, runAllActions} from '@tests/TestingUtils';
import {Phase} from '@/common/Phase';

function count(game: any, type: TileType): number {
  return game.board.spaces.filter((s: any) => s.tile?.tileType === type).length;
}

describe('probe ares hazard thresholds on Amazonis', () => {
  it('hazard track flows with Amazonis maxima', () => {
    const [game, player] = testGame(2, {
      boardName: BoardName.AMAZONIS_PLANITIA,
      aresExtension: true,
      aresHazards: true,
      underworldExpansion: true,
    });
    game.phase = Phase.ACTION;
    expect(count(game, TileType.DUST_STORM_MILD)).eq(3);
    for (let i = 0; i < 3; i++) addOcean(player);
    runAllActions(game);
    const mildErosions = count(game, TileType.EROSION_MILD);
    expect(mildErosions).eq(2);
    for (let i = 0; i < 3; i++) addOcean(player);
    runAllActions(game);
    expect(count(game, TileType.DUST_STORM_MILD)).eq(0);
    setOxygenLevel(game, 4);
    game.increaseOxygenLevel(player, 1);
    setTemperature(game, -6);
    game.increaseTemperature(player, 1);
    runAllActions(game);
    expect(count(game, TileType.EROSION_SEVERE)).eq(2);
    // Now fill the rest of oceans up to 11 and then run beyond
    for (let i = 0; i < 5; i++) addOcean(player);
    expect(game.board.getOceanSpaces().length).eq(11);
  });
});
