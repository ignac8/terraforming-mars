import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {Game} from '@/server/Game';
import {Board} from '@/server/boards/Board';
import {testGame} from '@tests/TestGame';
import {runAllActions, setOxygenLevel, setTemperature, maxOutOceans, setVenusScaleLevel} from '@tests/TestingUtils';
import {Phase} from '@/common/Phase';

const ALL = {
  venusNextExtension: true, coloniesExtension: true, turmoilExtension: true, aresExtension: true, aresHazards: true,
  moonExpansion: true, pathfindersExpansion: true, underworldExpansion: true, preludeExtension: true, prelude2Expansion: true,
  ceoExtension: true,
} as const;


function diffPaths(a: any, b: any, path = ''): Array<string> {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => diffPaths(a[k], b[k], path + '.' + k));
  }
  if (path.endsWith('startedAt')) return [];
  return [path + ' ' + JSON.stringify(a)?.slice(0, 60) + ' vs ' + JSON.stringify(b)?.slice(0, 60)];
}

describe('probe shape: solo + setup + serialization', () => {
  it('solo neutral setup places 2 cities + 2 forests, no adjacent cities, across many games (all expansions)', () => {
    for (let i = 0; i < 40; i++) {
      const [game] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA, ...ALL, shuffleMapOption: i % 2 === 0});
      const cities = game.board.getCities().filter((s) => s.spaceType !== SpaceType.COLONY);
      expect(cities, 'cities').has.length(2);
      for (const c of cities) {
        expect(game.board.getAdjacentSpaces(c).some(Board.isCitySpace)).is.false;
        expect(game.board.getAdjacentSpaces(c).some(Board.isGreenerySpace)).is.true;
      }
      expect(game.board.getGreeneries()).has.length(2);
    }
  });

  it('solo neutral setup, no expansions, many seeds, cities at distinct top/bottom halves', () => {
    for (let i = 0; i < 40; i++) {
      const [game] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
      const cities = game.board.getCities();
      expect(cities).has.length(2);
      // 'top' city should be in upper part of board and 'bottom' in lower part
      const ys = cities.map((c) => c.y).sort((a, b) => a - b);
      expect(ys[0]).lessThan(5);
      expect(ys[1]).greaterThan(5);
    }
  });

  for (const run of [
    {opts: {}, expected: 15},
    {opts: {preludeExtension: true}, expected: 13},
    {opts: {preludeExtension: true, venusNextExtension: true}, expected: 13},
    {opts: {venusNextExtension: true, requiresVenusTrackCompletion: true}, expected: 15},
    {opts: {preludeExtension: true, moonExpansion: true, requiresMoonTrackCompletion: true}, expected: 15},
    {opts: {soloTR: true}, expected: 14},
    {opts: {soloTR: true, preludeExtension: true}, expected: 12},
    {opts: {preludeExtension: true, prelude2Expansion: true}, expected: 13},
  ] as const) {
    it('lastSoloGeneration ' + JSON.stringify(run.opts), () => {
      const [game] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA, ...run.opts});
      expect(game.lastSoloGeneration()).eq(run.expected);
    });
  }

  it('solo win on Amazonis requires 14/18/11 and venus 33 in solo with Venus', () => {
    const [game, player] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true});
    setTemperature(game, 14);
    setOxygenLevel(game, 18);
    maxOutOceans(player, 11);
    expect(game.marsIsTerraformed()).is.false;
    setVenusScaleLevel(game, 33);
    expect(game.marsIsTerraformed()).is.true;
    expect(game.isSoloModeWin()).is.true;
  });

  it('solo win: terraformed on last generation (15) wins; 16 not', () => {
    const [game, player] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
    setTemperature(game, 14);
    setOxygenLevel(game, 18);
    maxOutOceans(player, 11);
    game.generation = 15;
    expect(game.isSoloModeWin()).is.true;
    expect(game.gameIsOver()).is.true;
    game.generation = 16;
    expect(game.isSoloModeWin()).is.false;
  });

  it('round trip: full amazonis game, all expansions, 3 players, mid-game state', () => {
    const [game, player, player2] = testGame(3, {boardName: BoardName.AMAZONIS_PLANITIA, ...ALL});
    setTemperature(game, 12);
    setOxygenLevel(game, 15);
    setVenusScaleLevel(game, 32);
    const sp = game.board.getAvailableSpacesForType(player, 'city')[0];
    game.addCity(player, sp);
    game.addGreenery(player2, game.board.getAvailableSpacesForGreenery(player2)[0]);
    runAllActions(game);
    const json = game.serialize();
    const copy = JSON.parse(JSON.stringify(json));
    const g2 = Game.deserialize(copy);
    expect(g2.gameOptions.boardName).eq(BoardName.AMAZONIS_PLANITIA);
    expect(g2.board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY)).has.length(91);
    expect((g2.board as any).max).deep.eq((game.board as any).max);
    expect(g2.max).deep.eq(game.max);
    expect(g2.getTemperature()).eq(12);
    expect(g2.getOxygenLevel()).eq(game.getOxygenLevel());
    expect(g2.getVenusScaleLevel()).eq(32);
    expect(g2.globalParameterTracks).deep.eq(game.globalParameterTracks);
    expect(g2.board.volcanicSpaceIds).deep.eq(game.board.volcanicSpaceIds);
    expect(g2.board.spaces.map((s) => [s.id, s.edge, s.x, s.y, s.bonus, s.tile?.tileType, s.volcanic])).deep.eq(
      game.board.spaces.map((s) => [s.id, s.edge, s.x, s.y, s.bonus, s.tile?.tileType, s.volcanic]));
    expect(g2.milestones.map((m) => m.name)).deep.eq(game.milestones.map((m) => m.name));
    expect(g2.awards.map((m) => m.name)).deep.eq(game.awards.map((m) => m.name));
    expect(g2.underworldData).deep.eq(game.underworldData);
    // serialize again must be stable
    expect(diffPaths(JSON.parse(JSON.stringify(g2.serialize())), copy)).deep.eq([]);
  });

  it('round trip: solo amazonis with neutral cities', () => {
    const [game] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA, ...ALL, coloniesExtension: false});
    const g2 = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    expect(g2.board.getCities().filter((s) => s.spaceType !== SpaceType.COLONY)).has.length(2);
    expect(g2.board.spaces.filter((s) => s.tile?.tileType === TileType.GREENERY)).has.length(2);
    expect(g2.phase).not.eq(Phase.END);
    const a = JSON.parse(JSON.stringify(g2.serialize()));
    const b = JSON.parse(JSON.stringify(game.serialize()));
    expect(diffPaths(a, b)).deep.eq([]);
  });
});
