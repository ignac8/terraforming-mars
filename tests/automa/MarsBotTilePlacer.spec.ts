import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {MarsBotTilePlacer} from '../../src/server/automa/MarsBotTilePlacer';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {cast, toID} from '@/common/utils/utils';

describe('MarsBotTilePlacer', () => {
  let game: IGame;
  let human: TestPlayer;
  let marsBot: TestPlayer;
  let tilePlacer: MarsBotTilePlacer;

  beforeEach(() => {
    [game, human, marsBot] = testGame(2);
    tilePlacer = new MarsBotTilePlacer(game, marsBot, human);
  });

  // TODO(kberg): Move to TestingUtils.
  /** An empty land space whose six neighbours are all empty land, so tiles can be arranged around it. */
  function inlandSpace(): Space {
    return game.board.getAvailableSpacesOnLand(marsBot).find((space) => {
      const adj = game.board.getAdjacentSpaces(space);
      return adj.length === 6 && adj.every((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
    })!;
  }

  it('findOceanSpace finds an ocean-reserved space', () => {
    const space = tilePlacer.findOceanSpace();

    expect(space!.spaceType).to.eq(SpaceType.OCEAN);
  });

  it('findOceanSpace returns undefined once every ocean space is taken', () => {
    for (const space of game.board.getAvailableSpacesForOcean(marsBot)) {
      game.simpleAddTile(marsBot, space, {tileType: TileType.OCEAN});
    }

    cast(tilePlacer.findOceanSpace(), undefined);
  });

  it('findCitySpace finds a city space', () => {
    expect(tilePlacer.findCitySpace()).is.not.undefined;
  });

  it('findCitySpace prefers a space next to a greenery', () => {
    const greenery = inlandSpace();
    game.simpleAddTile(human, greenery, {tileType: TileType.GREENERY});

    const space = tilePlacer.findCitySpace()!;

    expect(game.board.getAdjacentSpaces(space).some((s) => s.id === greenery.id)).is.true;
  });

  it('findGreenerySpace finds a space next to one of MarsBot\'s tiles', () => {
    const city = inlandSpace();
    game.simpleAddTile(marsBot, city, {tileType: TileType.CITY});

    const space = tilePlacer.findGreenerySpace()!;

    expect(game.board.getAdjacentSpaces(space).some((s) => s.id === city.id)).is.true;
  });

  it('findGreenerySpace prefers a space next to two of MarsBot\'s cities', () => {
    const first = inlandSpace();
    const second = game.board.getAdjacentSpaces(first)[0];
    game.simpleAddTile(marsBot, first, {tileType: TileType.CITY});
    game.simpleAddTile(marsBot, second, {tileType: TileType.CITY});

    const space = tilePlacer.findGreenerySpace()!;

    const adjacent = game.board.getAdjacentSpaces(space).map(toID);
    expect(adjacent).to.include.members([first.id, second.id]);
  });

  it('findGreenerySpace avoids the human\'s cities', () => {
    // Of the spaces next to MarsBot's city at 17, only 25 covers two bonus icons, so the
    // tiebreakers alone would choose it. The human city at 18 next door is what rules it out.
    game.simpleAddTile(marsBot, game.board.getSpaceOrThrow('17'), {tileType: TileType.CITY});
    game.simpleAddTile(human, game.board.getSpaceOrThrow('18'), {tileType: TileType.CITY});

    const space = tilePlacer.findGreenerySpace()!;

    expect(space.id).to.eq('24');
    expect(game.board.getAdjacentSpaces(space).some((s) => s.id === '18')).is.false;
  });

  // "Effectively it wants the greatest net gain of points" (njshaw2, BGG 3350125 and 3411375)
  it('findGreenerySpace scores MarsBot\'s adjacent cities minus the human\'s', () => {
    const a = inlandSpace();
    const adj = game.board.getAdjacentSpaces(a);
    // A: 2 MarsBot cities and 2 human cities, net 0
    game.simpleAddTile(marsBot, adj[0], {tileType: TileType.CITY});
    game.simpleAddTile(marsBot, adj[3], {tileType: TileType.CITY});
    game.simpleAddTile(human, adj[1], {tileType: TileType.CITY});
    game.simpleAddTile(human, adj[4], {tileType: TileType.CITY});
    // B: 1 MarsBot city and no human city, net +1
    const cityCount = (space: Space, player: TestPlayer) =>
      game.board.getAdjacentSpaces(space).filter((s) => s.tile?.tileType === TileType.CITY && s.player === player).length;
    const b = game.board.getAvailableSpacesForGreenery(marsBot)
      .find((s) => s !== a && cityCount(s, marsBot) === 1 && cityCount(s, human) === 0)!;
    expect(b).is.not.undefined;

    const space = tilePlacer.findGreenerySpace((s) => s === a || s === b);

    expect(space).to.eq(b);
  });

  it('findExpeditedConstructionCitySpace returns undefined on an empty board', () => {
    cast(tilePlacer.findExpeditedConstructionCitySpace(), undefined);
  });

  it('findExpeditedConstructionCitySpace returns undefined when only one greenery is adjacent', () => {
    game.simpleAddTile(human, inlandSpace(), {tileType: TileType.GREENERY});

    cast(tilePlacer.findExpeditedConstructionCitySpace(), undefined);
  });

  it('findExpeditedConstructionCitySpace finds the space next to two greeneries', () => {
    const [first, second] = game.board.getAdjacentSpaces(inlandSpace());
    game.simpleAddTile(human, first, {tileType: TileType.GREENERY});
    game.simpleAddTile(human, second, {tileType: TileType.GREENERY});

    const space = tilePlacer.findExpeditedConstructionCitySpace()!;

    const adjacent = game.board.getAdjacentSpaces(space).map(toID);
    expect(adjacent).to.include.members([first.id, second.id]);
  });

  // The card: any space next to 2+ greenery/ocean tiles, then the usual city rule, so 2 greeneries
  // beat 3 oceans (TDaver, BGG 3350125)
  it('findExpeditedConstructionCitySpace picks among the eligible spaces by the usual city rule', () => {
    const x = inlandSpace();
    const xArea = [x, ...game.board.getAdjacentSpaces(x)];
    for (const s of game.board.getAdjacentSpaces(x).slice(0, 3)) {
      game.simpleAddTile(human, s, {tileType: TileType.OCEAN});
    }
    const y = game.board.getAvailableSpacesOnLand(marsBot).find((space) => {
      const adj = game.board.getAdjacentSpaces(space);
      return adj.length === 6 && adj.every((s) => s.spaceType === SpaceType.LAND && s.tile === undefined) &&
        [space, ...adj].every((s) => game.board.getAdjacentSpaces(s).every((n) => !xArea.includes(n)));
    })!;
    const yAdj = game.board.getAdjacentSpaces(y);
    // Two opposite neighbours, so only Y touches both
    const shareOnlyY = (p: Space, q: Space) =>
      game.board.getAdjacentSpaces(p).filter((s) => s !== y && game.board.getAdjacentSpaces(q).includes(s)).length === 0;
    const p = yAdj[0];
    const q = yAdj.find((s) => s !== p && !game.board.getAdjacentSpaces(p).includes(s) && shareOnlyY(p, s))!;
    game.simpleAddTile(human, p, {tileType: TileType.GREENERY});
    game.simpleAddTile(human, q, {tileType: TileType.GREENERY});

    expect(tilePlacer.findExpeditedConstructionCitySpace()).to.eq(y);
  });

  it('findNeuralInstanceSpace avoids the spaces next to the one reserved for Noctis City', () => {
    // 30 and 39 border Noctis City and cover two bonus icons each, more than any space the
    // tile may go on, so the tiebreakers alone would choose one of them.
    const noctisCity = game.board.getSpaceOrThrow(SpaceName.NOCTIS_CITY);

    const space = tilePlacer.findNeuralInstanceSpace()!;

    expect(game.board.getAdjacentSpaces(noctisCity).map(toID)).to.not.include(space.id);
  });

  it('breaks ties on ocean adjacency first, then on bonus icons', () => {
    // MarsBot owns no tiles, so every land space is a greenery candidate and they all
    // score 0 on city adjacency. That leaves the tiebreakers to decide. Covering 03 leaves
    // 09 as the richest of the three spaces still free next to the ocean.
    game.simpleAddTile(human, game.board.getSpaceOrThrow('04'), {tileType: TileType.OCEAN});
    game.simpleAddTile(human, game.board.getSpaceOrThrow('03'), {tileType: TileType.GREENERY});

    const space = tilePlacer.findGreenerySpace()!;

    expect(space.id).to.eq('09');
    expect(space.bonus).deep.eq([SpaceBonus.STEEL]);
    // 09 is the only one of the three spaces still free next to the ocean that has a bonus at all.
    const adjacentOceans = game.board.getAvailableSpacesOnLand(marsBot)
      .filter((s) => game.board.getAdjacentSpaces(s).some((a) => a.tile?.tileType === TileType.OCEAN));
    expect(adjacentOceans.map(toID)).deep.eq(['05', '09', '10']);
    // Spaces covering two bonus icons are available, they just aren't next to an ocean.
    expect(Math.max(...game.board.getAvailableSpacesOnLand(marsBot).map((s) => s.bonus.length))).to.eq(2);
  });

  it('draws and discards one project card when spaces are still tied', () => {
    game.projectDeck.discardPile.length = 0;

    tilePlacer.findOceanSpace();

    expect(game.projectDeck.discardPile).has.length(1);
  });

  it('getPlacementBonusMC pays 1 M€ per bonus icon covered', () => {
    const space = game.board.getSpaceOrThrow('03');
    expect(space.bonus).deep.eq([SpaceBonus.STEEL, SpaceBonus.STEEL]);

    expect(tilePlacer.getPlacementBonusMC(space)).to.eq(2);
  });

  it('getPlacementBonusMC pays nothing for a space without bonus icons', () => {
    const space = game.board.getSpaceOrThrow('05');
    expect(space.bonus).is.empty;

    expect(tilePlacer.getPlacementBonusMC(space)).to.eq(0);
  });

  it('getOceanAdjacencyMC pays 2 M€ per adjacent ocean', () => {
    game.simpleAddTile(marsBot, game.board.getSpaceOrThrow('04'), {tileType: TileType.OCEAN});
    const neighbour = game.board.getSpaceOrThrow('05');

    expect(tilePlacer.getOceanAdjacencyMC(neighbour)).to.eq(2);
  });

  it('getOceanAdjacencyMC pays nothing next to an ocean-reserved space with no tile on it', () => {
    const neighbour = game.board.getSpaceOrThrow('05');
    const reserved = game.board.getAdjacentSpaces(neighbour).filter((s) => s.spaceType === SpaceType.OCEAN);
    expect(reserved.every((s) => s.tile === undefined)).is.true;

    expect(tilePlacer.getOceanAdjacencyMC(neighbour)).to.eq(0);
  });

  it('getTotalPlacementMC adds both parts together', () => {
    game.simpleAddTile(marsBot, game.board.getSpaceOrThrow('04'), {tileType: TileType.OCEAN});
    const neighbour = game.board.getSpaceOrThrow('03');
    expect(neighbour.bonus).deep.eq([SpaceBonus.STEEL, SpaceBonus.STEEL]);

    // 2 M€ for the two steel icons, 2 M€ for the one adjacent ocean.
    expect(tilePlacer.getTotalPlacementMC(neighbour)).to.eq(4);
  });
});
