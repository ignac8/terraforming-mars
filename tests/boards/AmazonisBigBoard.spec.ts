import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {expect} from 'chai';
import {AmazonisBigBoard} from '../../src/server/boards/AmazonisBigBoard';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SeededRandom} from '../../src/common/utils/Random';

describe('AmazonisBigBoard', () => {
  const board = AmazonisBigBoard.newInstance(DEFAULT_GAME_OPTIONS, new SeededRandom(0));

  it('has 93 spaces (91 mars + 2 colonies)', () => {
    expect(board.spaces).has.length(93);
  });

  it('mars space ids run a03..a93', () => {
    const marsSpaces = board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY);
    expect(marsSpaces).has.length(91);
    expect(marsSpaces[0].id).eq('a03');
    expect(marsSpaces[marsSpaces.length - 1].id).eq('a93');
  });

  it('colony spaces have ids 01 and 02', () => {
    const colonies = board.spaces.filter((s) => s.spaceType === SpaceType.COLONY);
    expect(colonies.map((s) => s.id)).deep.eq(['01', '02']);
  });

  it('first mars space a03 is at {x:5, y:0}', () => {
    const space = board.getSpaceOrThrow('a03');
    expect(space.x).eq(5);
    expect(space.y).eq(0);
  });

  it('widest row left edge is at {x:0, y:5}', () => {
    // The widest row (11 tiles) is y=5, with xOffset 0, so the leftmost space is x=0.
    const space = board.spaces.find((s) => s.x === 0 && s.y === 5);
    expect(space).is.not.undefined;
  });

  it('last mars space a93 is at {x:10, y:10}', () => {
    const space = board.getSpaceOrThrow('a93');
    expect(space.x).eq(10);
    expect(space.y).eq(10);
  });

  it('has at least 11 ocean spaces', () => {
    const oceanSpaces = board.spaces.filter((s) => s.spaceType === SpaceType.OCEAN);
    expect(oceanSpaces.length).is.at.least(11);
  });

  it('every row has the expected tile count', () => {
    const tilesPerRow = [6, 7, 8, 9, 10, 11, 10, 9, 8, 7, 6];
    const marsSpaces = board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY);
    for (let row = 0; row < tilesPerRow.length; row++) {
      const count = marsSpaces.filter((s) => s.y === row).length;
      expect(count, `row ${row}`).eq(tilesPerRow[row]);
    }
  });

  it('has volcanic spaces', () => {
    expect(board.volcanicSpaceIds.length).is.at.least(1);
    for (const id of board.volcanicSpaceIds) {
      expect(board.getSpaceOrThrow(id).volcanic).is.true;
    }
  });

  it('has one restricted space', () => {
    const restricted = board.spaces.filter((s) => s.spaceType === SpaceType.RESTRICTED);
    expect(restricted).has.length(1);
  });

  it('overrides the extended global parameter maxes', () => {
    expect(board.maxOceanTiles).eq(11);
    expect(board.maxTemperature).eq(14);
    expect(board.maxOxygenLevel).eq(18);
    expect(board.maxVenusScale).eq(33);
    expect(board.venusFieldValues).deep.eq(
      [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 31, 32, 33]);
  });

  it('getEdges returns the full perimeter (30 spaces) and excludes an interior space', () => {
    // Perimeter of a regular hexagon with side s=6 is 6*(s-1) = 30.
    const edges = board.getEdges();
    expect(edges).has.length(30);
    // An interior space (well off the perimeter) must be excluded.
    const interior = board.spaces.find((s) => s.x === 5 && s.y === 5);
    expect(interior).is.not.undefined;
    expect(edges.map((s) => s.id)).does.not.include(interior!.id);
  });

  it('an interior space has 6 neighbors, a corner has fewer', () => {
    const interior = board.spaces.find((s) => s.x === 5 && s.y === 5)!;
    const interiorNeighbors = board.getAdjacentSpaces(interior);
    expect(interiorNeighbors).has.length(6);
    for (const n of interiorNeighbors) {
      expect(n.spaceType).does.not.eq(SpaceType.COLONY);
    }

    // The top-left corner of the hexagon.
    const corner = board.getSpaceOrThrow('a03');
    expect(board.getAdjacentSpaces(corner).length).is.lessThan(6);
  });
});
