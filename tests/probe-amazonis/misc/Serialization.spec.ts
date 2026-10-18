import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, setTemperature, setOxygenLevel, setVenusScaleLevel, addOcean, addCity, addGreenery} from '@tests/TestingUtils';
import {Game} from '@/server/Game';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';

const options = {
  boardName: BoardName.AMAZONIS_PLANITIA,
  promoCardsOption: true,
  venusNextExtension: true,
  pathfindersExpansion: true,
  coloniesExtension: true,
  turmoilExtension: true,
  underworldExpansion: true,
  moonExpansion: true,
  aresExtension: true,
  preludeExtension: true,
  prelude2Expansion: true,
  ceoExtension: true,
  communityCardsOption: true,
  starWarsExpansion: true,
};

function diffPaths(a: any, b: any, path = '', out: Array<string> = []): Array<string> {
  if (out.length > 15) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    if (a !== b) out.push(`${path}: ${JSON.stringify(a)?.slice(0, 80)} vs ${JSON.stringify(b)?.slice(0, 80)}`);
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) diffPaths(a[k], b[k], path + '/' + k, out);
  return out;
}

describe('probe misc: Amazonis serialization', () => {
  for (const shuffle of [false, true]) {
    it(`serialize round trip keeps maxes/state (all expansions, shuffle=${shuffle})`, () => {
      const [game, player, other] = testGame(2, {...options, shuffleMapOption: shuffle});
      setTemperature(game, 12);
      setOxygenLevel(game, 17);
      setVenusScaleLevel(game, 32);
      for (let i = 0; i < 10; i++) addOcean(player);
      addCity(player);
      addCity(other);
      addGreenery(player);
      runAllActions(game);
      const s1 = JSON.stringify(game.serialize());
      const d = Game.deserialize(JSON.parse(s1));
      const s2 = JSON.stringify(d.serialize());
      expect(diffPaths(JSON.parse(s1), JSON.parse(s2)).filter((x) => !x.includes('/timer/'))).deep.eq([]);
      expect(d.max).deep.eq(game.max);
      expect(d.globalParameterTracks).deep.eq(game.globalParameterTracks);
      expect(d.board.spaces.length).eq(game.board.spaces.length);
      expect(d.board.volcanicSpaceIds).deep.eq(game.board.volcanicSpaceIds);
      expect(d.getVenusScaleLevel()).eq(32);
    });
  }

  it('milestone/award selection works with random MA on Amazonis', () => {
    const [game] = testGame(2, {...options, randomMA: RandomMAOptionType.LIMITED});
    // Venus is on, so 6 are drawn (requiredQty = 6 with Venus).
    expect(game.milestones.length).eq(6);
    expect(game.awards.length).eq(6);
  });
});
