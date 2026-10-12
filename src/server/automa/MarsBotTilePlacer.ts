import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Space} from '../boards/Space';
import {Board, isSpecialTileSpace} from '../boards/Board';
import {SpaceType} from '../../common/boards/SpaceType';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {BoardName} from '../../common/boards/BoardName';
import {HELLAS_BONUS_OCEAN_COST, TERRA_CIMMERIA_COLONY_COST, VASTITAS_BOREALIS_NOVA_BONUS_TEMPERATURE_COST} from '../../common/constants';
import {eligibleColoniesForMarsBot, placeColonyForMarsBot, selectRandomColony} from './colonies/MarsBotColonyPlacer';

/** Narrows the spaces still tied after the ones before it. Never returns an empty list. */
type Tiebreaker = (tied: ReadonlyArray<Space>) => ReadonlyArray<Space>;
type TiebreakerName = 'oceans' | 'icons' | 'polarRegion' | 'southernRegion' | 'specialTiles' | 'edgeElseOceans';

/**
 * The tiebreakers each map's player aid lists, in order. The flipped project card always comes last.
 * Rulebook C, p.10. Maps that aren't listed (Tharsis) use `DEFAULT_TIEBREAKERS`.
 */
const DEFAULT_TIEBREAKERS: ReadonlyArray<TiebreakerName> = ['oceans', 'icons'];
const MAP_TIEBREAKERS: Partial<Record<BoardName, ReadonlyArray<TiebreakerName>>> = {
  [BoardName.HELLAS]: ['oceans', 'polarRegion', 'icons'],
  [BoardName.ELYSIUM]: ['oceans', 'icons', 'southernRegion'],
  [BoardName.TERRA_CIMMERIA_NOVA]: ['oceans', 'specialTiles', 'icons'],
  [BoardName.UTOPIA_PLANITIA]: ['oceans', 'icons'],
  [BoardName.VASTITAS_BOREALIS_NOVA]: ['icons', 'edgeElseOceans'],
};

/**
 * Spaces that count as one more reward icon when tiebreaking. The icons are still worth 1 M€ each
 * only when they are printed on the space.
 */
const EXTRA_ICON: Partial<Record<BoardName, (board: Board, space: Space) => boolean>> = {
  [BoardName.UTOPIA_PLANITIA]: (_board, space) => space.edge,
  [BoardName.VASTITAS_BOREALIS_NOVA]: (board, space) =>
    space.volcanic === true || board.getAdjacentSpaces(space).some((s) => s.volcanic === true),
};

/**
 * The placement bonuses that cost a player M€, with that cost. MarsBot doesn't get the bonus the
 * usual way, see `resolveSpecialHex` (rulebook C, p.11).
 */
const SPECIAL_HEX_COSTS: ReadonlyMap<SpaceBonus, number> = new Map([
  [SpaceBonus.OCEAN, HELLAS_BONUS_OCEAN_COST],
  [SpaceBonus.TEMPERATURE_4MC, VASTITAS_BOREALIS_NOVA_BONUS_TEMPERATURE_COST],
  [SpaceBonus.COLONY, TERRA_CIMMERIA_COLONY_COST],
]);

/** Higher than the other hexes with two icons, lower than the ones with three. */
const SPECIAL_HEX_ICONS = 2.5;

/**
 * Handles MarsBot tile placement with automa-specific rules and tiebreakers.
 *
 * Greenery: Adjacent to as many MarsBot cities as possible, minimize adjacency to human cities.
 * City: Adjacent to as much existing greenery as possible. Standard city rules.
 * Ocean: Any ocean-reserved space.
 *
 * Tiebreakers (after type-specific rules), on Tharsis:
 *   1. Adjacent to as many oceans as possible.
 *   2. Cover the most placement bonus icons.
 *   3. Random (flip a project card, use cost to count through tied spaces).
 *
 * The other maps reorder these and add their own, see `MAP_TIEBREAKERS`.
 */
export class MarsBotTilePlacer {
  constructor(
    private readonly game: IGame,
    private readonly marsBot: IPlayer,
    private readonly humanPlayer: IPlayer,
  ) {}

  /**
   * Find the best space for MarsBot to place a greenery. Returns undefined if none available.
   *
   * `where` limits the choice to the legal greenery spaces it accepts.
   */
  public findGreenerySpace(where: (space: Space) => boolean = () => true): Space | undefined {
    const board = this.game.board;
    const spaces = board.getAvailableSpacesForGreenery(this.marsBot).filter(where);
    if (spaces.length === 0) {
      return undefined;
    }

    return this.selectBestSpace(spaces, (space) => {
      const cities = board.getAdjacentSpaces(space).filter(Board.isCitySpace);
      const marsBotCities = cities.filter(Board.ownedBy(this.marsBot));
      const humanCities = cities.filter(Board.ownedBy(this.humanPlayer));
      // Maximize MarsBot cities adjacency, then minimize human cities adjacency
      return marsBotCities.length * 100 - humanCities.length;
    });
  }

  /**
   * Find the best space for MarsBot to place a city. Returns undefined if none available.
   *
   * `where` limits the choice to the legal city spaces it accepts.
   */
  public findCitySpace(where: (space: Space) => boolean = () => true): Space | undefined {
    const board = this.game.board;
    const spaces = board.getAvailableSpacesForCity(this.marsBot).filter(where);
    if (spaces.length === 0) {
      return undefined;
    }

    return this.selectBestSpace(spaces, (space) => {
      const adj = board.getAdjacentSpaces(space);
      return adj.filter((s) => Board.isGreenerySpace(s)).length;
    });
  }

  /**
   * Find the best space for MarsBot to place a city next to at least two greenery or ocean tiles.
   * This is what the Expedited Construction bonus card (B05) asks for.
   */
  public findExpeditedConstructionCitySpace(): Space | undefined {
    const board = this.game.board;
    const adjacentGreeneryOrOcean = (space: Space) => board.getAdjacentSpaces(space)
      .filter((s) => Board.isGreenerySpace(s) || Board.isOceanSpace(s)).length;

    const eligible = board.getAvailableSpacesForCity(this.marsBot)
      .filter((space) => adjacentGreeneryOrOcean(space) >= 2);
    if (eligible.length === 0) {
      return undefined;
    }

    return this.selectBestSpace(eligible, adjacentGreeneryOrOcean);
  }

  /**
   * Finds the best space for a MarsBot city next to at least one of the human's greeneries.
   * This is what the Build, Build, Build bonus card (B27) asks for first.
   */
  public findCitySpaceNextToHumanGreenery(): Space | undefined {
    const board = this.game.board;
    const eligible = board.getAvailableSpacesForCity(this.marsBot).filter((space) =>
      board.getAdjacentSpaces(space).some((s) => Board.isGreenerySpace(s) && Board.spaceOwnedBy(s, this.humanPlayer)));
    return this.selectBestSpace(eligible, (space) => board.getAdjacentSpaces(space).filter(Board.isGreenerySpace).length);
  }

  /**
   * Finds the best land space for a MarsBot special tile next to at least one of the human's cities.
   * This is what the Build, Build, Build bonus card (B27) asks for second.
   */
  public findSpecialTileSpaceNextToHumanCity(): Space | undefined {
    const board = this.game.board;
    const eligible = board.getAvailableSpacesOnLand(this.marsBot).filter((space) =>
      board.getAdjacentSpaces(space).some((s) => Board.isCitySpace(s) && Board.spaceOwnedBy(s, this.humanPlayer)));
    return this.selectBestSpace(eligible, () => 0);
  }

  /**
   * Find the best space for MarsBot to place an ocean. Returns undefined if none available.
   *
   * `where` limits the choice to the ocean spaces it accepts.
   */
  public findOceanSpace(where: (space: Space) => boolean = () => true): Space | undefined {
    const spaces = this.game.board.getAvailableSpacesForOcean(this.marsBot).filter(where);
    if (spaces.length === 0) {
      return undefined;
    }
    // Oceans have no type-specific primary sort, go straight to tiebreakers.
    return this.selectBestSpace(spaces, () => 0);
  }

  /** Find a space for the Neural Instance tile: not adjacent to any tiles, not on edge, not on/adjacent to reserved spaces. */
  public findNeuralInstanceSpace(): Space | undefined {
    const board = this.game.board;
    const spaces = board.getAvailableSpacesOnLand(this.marsBot).filter((space) => {
      const adj = board.getAdjacentSpaces(space);
      // Adjacent to no tiles
      if (adj.some((s) => s.tile !== undefined)) {
        return false;
      }
      // Not on edge (has fewer than 6 adjacent spaces means edge)
      if (adj.length < 6) {
        return false;
      }
      // Not adjacent to reserved spaces (ocean-reserved, restricted, specific cities)
      return !adj.some((s) =>
        s.spaceType === SpaceType.OCEAN || s.spaceType === SpaceType.RESTRICTED || s.id === board.noctisCitySpaceId);
    });
    if (spaces.length === 0) {
      return undefined;
    }
    return this.selectBestSpace(spaces, () => 0);
  }

  /**
   * Finds the space for one of MarsBot's player markers (Settlers): a land space that is not
   * reserved and has neither a tile nor a marker.
   *
   * After the usual tiebreakers and before the random one, it prefers the space next to the most
   * ocean-reserved spaces.
   */
  public findMarkerSpace(): Space | undefined {
    const board = this.game.board;
    const spaces = board.getAvailableSpacesOnLand(this.marsBot).filter((space) => space.player === undefined);
    return this.selectBestSpace(spaces, () => 0,
      (space) => board.getAdjacentSpaces(space).filter((s) => s.spaceType === SpaceType.OCEAN).length);
  }

  /**
   * Select the best space from candidates using:
   * 1. primaryScore function (type-specific)
   * 2. The map's tiebreakers, in order (see `MAP_TIEBREAKERS`)
   * 3. beforeRandomScore, when a card adds its own tiebreaker ahead of the random one
   * 4. Random (using project deck card cost)
   */
  private selectBestSpace(
    spaces: ReadonlyArray<Space>,
    primaryScore: (space: Space) => number,
    beforeRandomScore: (space: Space) => number = () => 0,
  ): Space | undefined {
    if (spaces.length === 0) {
      return undefined;
    }
    if (spaces.length === 1) {
      return spaces[0];
    }

    const names = MAP_TIEBREAKERS[this.game.gameOptions.boardName] ?? DEFAULT_TIEBREAKERS;
    const tiebreakers = [
      mostOf(primaryScore),
      ...names.map((name) => this.tiebreaker(name)),
      mostOf(beforeRandomScore),
    ];

    let tied = spaces;
    for (const tiebreaker of tiebreakers) {
      tied = tiebreaker(tied);
      if (tied.length === 1) {
        return tied[0];
      }
    }

    return this.randomTiebreak(tied);
  }

  private tiebreaker(name: TiebreakerName): Tiebreaker {
    const board = this.game.board;
    switch (name) {
    case 'oceans':
      return mostOf((space) => this.adjacentOceans(space));
    case 'icons':
      return mostOf((space) => this.tiebreakIcons(space));
    case 'polarRegion':
      return preferring((space) => space.y >= board.bottomRow - 1);
    case 'southernRegion':
      return preferring((space) => space.y >= board.bottomRow - 3);
    case 'specialTiles':
      return preferring((space) => board.getAdjacentSpaces(space).some(isSpecialTileSpace));
    case 'edgeElseOceans':
      return (tied) => {
        const edges = tied.filter((space) => space.edge);
        return edges.length > 0 ? edges : mostOf((space) => this.adjacentOceans(space))(tied);
      };
    }
  }

  private adjacentOceans(space: Space): number {
    return this.game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length;
  }

  /** The reward icons MarsBot tiebreaks on: what the space gives it, plus whatever the map adds. */
  private tiebreakIcons(space: Space): number {
    const bonus = this.specialBonus(space);
    let icons = this.placementIcons(space);
    if (bonus !== undefined) {
      icons = this.canGetSpecialBonus(bonus) ? SPECIAL_HEX_ICONS : 0;
    }
    if (EXTRA_ICON[this.game.gameOptions.boardName]?.(this.game.board, space)) {
      icons++;
    }
    return icons;
  }

  /**
   * The icons on `space` that give MarsBot 1 M€ each. The hexes that cost M€ give nothing here, and
   * the Turmoil delegate gives nothing without Turmoil.
   */
  private placementIcons(space: Space): number {
    return space.bonus.filter((bonus) => {
      if (bonus === SpaceBonus.DELEGATE) {
        return this.game.turmoil !== undefined;
      }
      return !SPECIAL_HEX_COSTS.has(bonus);
    }).length;
  }

  private specialBonus(space: Space): SpaceBonus | undefined {
    return [...SPECIAL_HEX_COSTS.keys()].find((bonus) => space.bonus.includes(bonus));
  }

  private specialHexCost(bonus: SpaceBonus): number {
    return SPECIAL_HEX_COSTS.get(bonus) ?? 0;
  }

  /** True when MarsBot has the M€ for `bonus` and there is still something to get for it. */
  private canGetSpecialBonus(bonus: SpaceBonus): boolean {
    const game = this.game;
    if (this.marsBot.megaCredits < this.specialHexCost(bonus)) {
      return false;
    }
    switch (bonus) {
    case SpaceBonus.OCEAN:
      return game.canAddOcean() && game.board.getAvailableSpacesForOcean(this.marsBot).length > 0;
    case SpaceBonus.TEMPERATURE_4MC:
      return game.getTemperature() < game.max.temperature;
    case SpaceBonus.COLONY: {
      const marsBot = game.automaHooks?.marsBot;
      return marsBot !== undefined && eligibleColoniesForMarsBot(game, marsBot).length > 0;
    }
    default:
      return false;
    }
  }

  /**
   * Called once MarsBot has placed a tile on `space`. On the hexes that cost M€, MarsBot pays for
   * the bonus and gets it when it can. Otherwise it neither pays nor gets anything.
   */
  public resolveSpecialHex(space: Space): void {
    const bonus = this.specialBonus(space);
    const marsBot = this.game.automaHooks?.marsBot;
    if (bonus === undefined || marsBot === undefined || !this.canGetSpecialBonus(bonus)) {
      return;
    }
    marsBot.turnResolver.megacredits -= this.specialHexCost(bonus);
    switch (bonus) {
    case SpaceBonus.OCEAN:
      marsBot.turnResolver.placeOcean();
      break;
    case SpaceBonus.TEMPERATURE_4MC:
      marsBot.turnResolver.raiseTemperature(1);
      break;
    case SpaceBonus.COLONY: {
      // The way Expedited Construction picks and builds one.
      const colony = selectRandomColony(this.game, marsBot);
      if (colony !== undefined) {
        placeColonyForMarsBot(colony, marsBot);
      }
      break;
    }
    }
  }

  /**
   * Break a tie by flipping a project card and counting through spaces: cost 1 is the first space,
   * and a cost of 0 counts back to the last.
   */
  private randomTiebreak(spaces: ReadonlyArray<Space>): Space {
    const card = this.game.projectDeck.drawOrThrow(this.game);
    this.game.projectDeck.discard(card);
    const n = spaces.length;
    return spaces[((card.cost - 1) % n + n) % n];
  }

  /** Calculate MC MarsBot gains from placement bonuses (1 MC per icon covered). */
  public getPlacementBonusMC(space: Space): number {
    return this.placementIcons(space);
  }

  /** Calculate MC MarsBot gains from ocean adjacency (2 MC per adjacent ocean, 3 for Lakefront). */
  public getOceanAdjacencyMC(space: Space): number {
    const oceans = this.game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length;
    const perOcean = this.game.automaHooks?.marsBot.corp?.oceanAdjacencyMc ?? 2;
    return oceans * perOcean;
  }

  /** Total placement MC for MarsBot: 1 MC per bonus icon + M€ per adjacent ocean. */
  public getTotalPlacementMC(space: Space): number {
    return this.getPlacementBonusMC(space) + this.getOceanAdjacencyMC(space);
  }
}

/** Keeps the spaces with the highest score. */
function mostOf(score: (space: Space) => number): Tiebreaker {
  return (tied) => {
    const scores = tied.map(score);
    const best = Math.max(...scores);
    return tied.filter((_, i) => scores[i] === best);
  };
}

/** Keeps the spaces that satisfy `wanted`, when any do. */
function preferring(wanted: (space: Space) => boolean): Tiebreaker {
  return (tied) => {
    const preferred = tied.filter(wanted);
    return preferred.length > 0 ? preferred : tied;
  };
}
