import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Space} from '../boards/Space';
import {Board, isSpecialTileSpace} from '../boards/Board';
import {SpaceType} from '../../common/boards/SpaceType';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {BoardName} from '../../common/boards/BoardName';
import {MilestoneName} from '../../common/ma/MilestoneName';
import {AwardName} from '../../common/ma/AwardName';
import {HELLAS_BONUS_OCEAN_COST, TERRA_CIMMERIA_COLONY_COST, VASTITAS_BOREALIS_NOVA_BONUS_TEMPERATURE_COST} from '../../common/constants';
import {IMarsBot} from './IMarsBot';
import {Comparator, comparing, compound, reversed} from '../../common/utils/Ordering';

/**
 * Scores a space for one tiebreaker.
 *
 * The higher score wins.
 */
type Scorer = (space: Space) => number;
type TiebreakerName = 'oceans' | 'icons' | 'polarRegion' | 'southernRegion' | 'specialTiles' | 'edge';

/** The tiebreakers of Tharsis, and of any map `MAP_TIEBREAKERS` doesn't list. */
const DEFAULT_TIEBREAKERS: ReadonlyArray<TiebreakerName> = ['oceans', 'icons'];

/**
 * The tiebreakers each map's player aid lists, in order.
 *
 * The flipped project card always comes last (rulebook C, p.10).
 */
const MAP_TIEBREAKERS: Partial<Record<BoardName, ReadonlyArray<TiebreakerName>>> = {
  [BoardName.HELLAS]: ['oceans', 'polarRegion', 'icons'],
  [BoardName.ELYSIUM]: ['oceans', 'icons', 'southernRegion'],
  [BoardName.TERRA_CIMMERIA_NOVA]: ['oceans', 'specialTiles', 'icons'],
  [BoardName.UTOPIA_PLANITIA]: ['oceans', 'icons'],
  // The aid reads "edge spaces, if possible, otherwise adjacent to as many oceans as possible".
  // The oceans are the next tiebreaker, so they also decide between edge spaces.
  [BoardName.VASTITAS_BOREALIS_NOVA]: ['icons', 'edge', 'oceans'],
};

/**
 * True for the spaces that count as one more reward icon when tiebreaking.
 *
 * These icons never give M€, only the ones printed on the space do.
 */
type ExtraIcon = (board: Board, space: Space) => boolean;

const onEdge: ExtraIcon = (_board, space) => space.edge;
const onOrNextToVolcanic: ExtraIcon = (board, space) =>
  space.volcanic === true || board.getAdjacentSpaces(space).some((s) => s.volcanic === true);
const nextToSpecialTile: ExtraIcon = (board, space) => board.getAdjacentSpaces(space).some(isSpecialTileSpace);

/** The extra icon each map's player aid adds. */
const MAP_EXTRA_ICON: Partial<Record<BoardName, ExtraIcon>> = {
  [BoardName.UTOPIA_PLANITIA]: onEdge,
  [BoardName.VASTITAS_BOREALIS_NOVA]: onOrNextToVolcanic,
};

/**
 * The extra icon a milestone or award of the Milestones & Awards expansion adds while it is in play.
 *
 * Where the map already adds the same one, it counts once (rulebook C, pp.13-15).
 */
const MA_EXTRA_ICON: Partial<Record<MilestoneName | AwardName, ExtraIcon>> = {
  'Geologist': onOrNextToVolcanic,
  'Founder': nextToSpecialTile,
  'Suburbian': onEdge,
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
 * Greenery: Adjacent to as many MarsBot cities as possible, less the human's adjacent cities.
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
    /** The bot that pays for the special hexes and gets their effects. Without one they are empty hexes. */
    private readonly bot?: IMarsBot,
  ) {}

  /**
   * The map whose player aid MarsBot reads its tiebreakers from.
   *
   * The Milestones & Awards expansion plays against the Tharsis board and reference card whatever
   * the map (rulebook C, p.13).
   */
  private mapName(): BoardName {
    const options = this.game.gameOptions;
    return options.modularMA ? BoardName.THARSIS : options.boardName;
  }

  /** The extra icons in play: the map's and those of the milestones and awards. */
  private extraIcons(): ReadonlySet<ExtraIcon> {
    const names = [...this.game.milestones, ...this.game.awards].map((ma) => ma.name);
    const icons = [MAP_EXTRA_ICON[this.mapName()], ...names.map((name) => MA_EXTRA_ICON[name])];
    return new Set(icons.filter((icon) => icon !== undefined));
  }

  /**
   * The map's tiebreakers, in order.
   *
   * With the Highlander award in play, "adjacent to ocean" comes after the reward icons (rulebook C,
   * p.15).
   */
  private tiebreakerNames(): ReadonlyArray<TiebreakerName> {
    const names = MAP_TIEBREAKERS[this.mapName()] ?? DEFAULT_TIEBREAKERS;
    if (!this.game.awards.some((award) => award.name === 'Highlander')) {
      return names;
    }
    if (names.indexOf('oceans') > names.indexOf('icons')) {
      return names;
    }
    const reordered: Array<TiebreakerName> = names.filter((name) => name !== 'oceans');
    reordered.splice(reordered.indexOf('icons') + 1, 0, 'oceans');
    return reordered;
  }

  /**
   * Find the best space for MarsBot to place a greenery. Returns undefined if none available.
   *
   * @param filter limits the choice to the legal greenery spaces it accepts.
   */
  public findGreenerySpace(filter: (space: Space) => boolean = () => true): Space | undefined {
    const board = this.game.board;
    const spaces = board.getAvailableSpacesForGreenery(this.marsBot).filter(filter);
    if (spaces.length === 0) {
      return undefined;
    }

    return this.selectBestSpace(spaces, (space) => {
      const cities = board.getAdjacentSpaces(space).filter(Board.isCitySpace);
      const marsBotCities = cities.filter(Board.ownedBy(this.marsBot));
      const humanCities = cities.filter(Board.ownedBy(this.humanPlayer));
      // MarsBot's adjacent cities minus the human's. The greenery gives 1 VP to the owner of each
      // adjacent city, so the highest score is the space with the best net VP for MarsBot.
      // https://boardgamegeek.com/thread/3350125/article/44711805#44711805 (njshaw2)
      // https://boardgamegeek.com/thread/3411375/article/45234897#45234897 (njshaw2, ties are random)
      return marsBotCities.length - humanCities.length;
    });
  }

  /**
   * Find the best space for MarsBot to place a city. Returns undefined if none available.
   *
   * @param filter limits the choice to the legal city spaces it accepts.
   */
  public findCitySpace(filter: (space: Space) => boolean = () => true): Space | undefined {
    const board = this.game.board;
    const spaces = board.getAvailableSpacesForCity(this.marsBot).filter(filter);
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
   *
   * Among those spaces the usual city rule picks, so 2 greeneries beat 3 oceans. The card's
   * wording wins over the rulebook's "most tiles of these types". The card's author (TDaver):
   * https://boardgamegeek.com/thread/3350125/article/44720677#44720677
   */
  public findExpeditedConstructionCitySpace(): Space | undefined {
    const board = this.game.board;
    const adjacentGreeneryOrOcean = (space: Space) => board.getAdjacentSpaces(space)
      .filter((s) => Board.isGreenerySpace(s) || Board.isOceanSpace(s)).length;
    return this.findCitySpace((space) => adjacentGreeneryOrOcean(space) >= 2);
  }

  /**
   * Finds the best space for a MarsBot city next to at least one of the human's greeneries.
   * This is what the Build, Build, Build bonus card (B27) asks for first.
   */
  public findCitySpaceNextToHumanGreenery(): Space | undefined {
    const board = this.game.board;
    return this.findCitySpace((space) =>
      board.getAdjacentSpaces(space).some((s) => Board.isGreenerySpace(s) && Board.spaceOwnedBy(s, this.humanPlayer)));
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
   * @param filter limits the choice to the ocean spaces it accepts.
   */
  public findOceanSpace(filter: (space: Space) => boolean = () => true): Space | undefined {
    const spaces = this.game.board.getAvailableSpacesForOcean(this.marsBot).filter(filter);
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
   * 1. primaryScorer (type-specific)
   * 2. The map's tiebreakers, in order (see `MAP_TIEBREAKERS`)
   * 3. beforeRandomScorer, when a card adds its own tiebreaker ahead of the random one
   * 4. Random (using project deck card cost)
   */
  private selectBestSpace(
    spaces: ReadonlyArray<Space>,
    primaryScorer: Scorer,
    beforeRandomScorer: Scorer = () => 0,
  ): Space | undefined {
    if (spaces.length === 0) {
      return undefined;
    }
    if (spaces.length === 1) {
      return spaces[0];
    }

    const extraIcons = this.extraIcons();
    const scorers: ReadonlyArray<Scorer> = [
      primaryScorer,
      ...this.tiebreakerNames().map((name) => this.tiebreaker(name, extraIcons)),
      beforeRandomScorer,
    ];

    // Highest first, each scorer breaking the ties of the ones before it
    const ranking: Comparator<Space> = reversed(compound(...scorers.map((scorer) => comparing(scorer))));
    const sorted = [...spaces].sort(ranking);

    // Find all tied for best. The sort is stable, so they stay in board order for the random tiebreak.
    const tied = sorted.filter((space) => ranking(space, sorted[0]) === 0);

    if (tied.length === 1) {
      return tied[0];
    }

    return this.randomTiebreak(tied);
  }

  /** Scores spaces for one of the map's tiebreakers. */
  private tiebreaker(name: TiebreakerName, extraIcons: ReadonlySet<ExtraIcon>): Scorer {
    const board = this.game.board;
    switch (name) {
    case 'oceans':
      return (space) => this.adjacentOceans(space);
    case 'icons':
      return (space) => this.iconCount(space, extraIcons);
    case 'polarRegion':
      // The two rows at the bottom of the map.
      return preferring((space) => space.y >= board.bottomRow - 1);
    case 'southernRegion':
      return preferring((space) => space.y > board.equatorRow);
    case 'specialTiles':
      return preferring((space) => board.getAdjacentSpaces(space).some(isSpecialTileSpace));
    case 'edge':
      return preferring((space) => space.edge);
    }
  }

  private adjacentOceans(space: Space): number {
    return this.game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length;
  }

  /**
   * How many reward icons `space` counts as when tiebreaking: the ones that give M€, plus one for
   * each extra icon the space matches. A hex that costs M€ counts as `SPECIAL_HEX_ICONS` when
   * MarsBot can get its bonus, and as empty otherwise.
   */
  private iconCount(space: Space, extraIcons: ReadonlySet<ExtraIcon>): number {
    const special = this.specialBonus(space);
    let count = this.paidIconCount(space);
    if (special !== undefined) {
      count = this.canGetSpecialBonus(special) ? SPECIAL_HEX_ICONS : 0;
    }
    for (const extraIcon of extraIcons) {
      if (extraIcon(this.game.board, space)) {
        count++;
      }
    }
    return count;
  }

  /**
   * How many icons on `space` give MarsBot 1 M€ each. Not the hexes that cost M€, and not the
   * Turmoil delegate without Turmoil, which counts as empty (rulebook C, p.11).
   */
  private paidIconCount(space: Space): number {
    return space.bonus.filter((bonus) => {
      if (SPECIAL_HEX_COSTS.has(bonus)) {
        return false;
      }
      return bonus !== SpaceBonus.DELEGATE || this.game.turmoil !== undefined;
    }).length;
  }

  private specialBonus(space: Space): SpaceBonus | undefined {
    return [...SPECIAL_HEX_COSTS.keys()].find((bonus) => space.bonus.includes(bonus));
  }

  private specialHexCost(bonus: SpaceBonus): number {
    return SPECIAL_HEX_COSTS.get(bonus) ?? 0;
  }

  /**
   * True when MarsBot has the M€ for `bonus` and there is still something to get for it. Never once
   * the game is decided: the final greeneries don't trigger the hex.
   */
  private canGetSpecialBonus(bonus: SpaceBonus): boolean {
    const game = this.game;
    if (game.isDoneWithFinalProduction()) {
      return false;
    }
    const bot = this.bot;
    // The M€ supply only: megaCredits also counts the Luna storage area
    if (bot === undefined || bot.megacredits < this.specialHexCost(bonus)) {
      return false;
    }
    switch (bonus) {
    case SpaceBonus.OCEAN:
      return game.canAddOcean() && game.board.getAvailableSpacesForOcean(this.marsBot).length > 0;
    case SpaceBonus.TEMPERATURE_4MC:
      return game.getTemperature() < game.max.temperature;
    case SpaceBonus.COLONY:
      return bot.canPlaceColony();
    default:
      return false;
    }
  }

  /**
   * Called once MarsBot has placed a tile on `space`. On the hexes that cost M€, MarsBot pays for
   * the bonus and gets it when it can. Otherwise it neither pays nor gets anything, which includes
   * a bonus its corporation swallows (Pristar) or one that finds no colony to build.
   */
  public resolveSpecialHex(space: Space): void {
    const bonus = this.specialBonus(space);
    const bot = this.bot;
    if (bonus === undefined || bot === undefined || !this.canGetSpecialBonus(bonus)) {
      return;
    }
    const game = this.game;
    let resolved = false;
    switch (bonus) {
    case SpaceBonus.OCEAN: {
      const oceans = game.board.getOceanSpaces().length;
      bot.placeOcean();
      resolved = game.board.getOceanSpaces().length > oceans;
      break;
    }
    case SpaceBonus.TEMPERATURE_4MC: {
      const temperature = game.getTemperature();
      bot.raiseTemperature(1);
      resolved = game.getTemperature() > temperature;
      break;
    }
    case SpaceBonus.COLONY:
      // The way Expedited Construction picks and builds one.
      resolved = bot.maybePlaceRandomColony();
      break;
    }
    if (resolved) {
      bot.megacredits -= this.specialHexCost(bonus);
    }
  }

  /**
   * Break a tie by flipping a project card and counting its cost through the tied spaces. Counting
   * starts at 1 on the first space and goes back to the first after passing the last. A cost of 0
   * picks the last space.
   */
  private randomTiebreak(spaces: ReadonlyArray<Space>): Space {
    const card = this.game.projectDeck.drawOrThrow(this.game);
    this.game.projectDeck.discard(card);
    const index = card.cost === 0 ? spaces.length - 1 : (card.cost - 1) % spaces.length;
    return spaces[index];
  }

  /** Calculate MC MarsBot gains from placement bonuses (1 MC per icon covered). */
  public getPlacementBonusMC(space: Space): number {
    return this.paidIconCount(space);
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

/** Puts the spaces that satisfy `wanted` ahead of the rest. */
function preferring(wanted: (space: Space) => boolean): Scorer {
  return (space) => wanted(space) ? 1 : 0;
}
