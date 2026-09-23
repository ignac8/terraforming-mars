import {BonusCardId} from '../../common/automa/AutomaTypes';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {CardResource} from '../../common/CardResource';
import {GlobalParameter} from '../../common/GlobalParameter';
import {TileType} from '../../common/TileType';
import {Board, isSpecialTileSpace} from '../boards/Board';
import * as constants from '../../common/constants';
import {MarsBotBonusCard, MarsBotBonusDeckCard, bonusCardDisplayName} from './MarsBotBonusCard';
import {MarsBotBonusDeck} from './MarsBotBonusDeck';
import {MarsBotTilePlacer} from './MarsBotTilePlacer';
import {MarsBotTurnResolver} from './MarsBotTurnResolver';
import {IProjectCard} from '../cards/IProjectCard';
import {CardType} from '../../common/cards/CardType';
import {Space} from '../boards/Space';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {marsBotCardTags} from './MarsBotTags';
import {MarsBotTurmoilHelper} from './turmoil/MarsBotTurmoilHelper';
import {selectRandomColony, placeColonyForMarsBot} from './colonies/MarsBotColonyPlacer';
import {selectTradeColony, tradeWithColony} from './colonies/MarsBotTrader';
import {inplaceShuffle} from '../utils/shuffle';
import type {MarsBot} from './MarsBot';
import {inplaceRemove, inplaceRemoveIf} from '../../common/utils/utils';

/**
 * The special tile each project card MarsBot can play shows, for Build, Build, Build (B27).
 *
 * Capital and New Holland are left out: their tiles are cities, and a city can't go next to the
 * player's city.
 */
const SPECIAL_TILES: ReadonlyMap<CardName, TileType> = new Map([
  [CardName.COMMERCIAL_DISTRICT, TileType.COMMERCIAL_DISTRICT],
  [CardName.ECOLOGICAL_ZONE, TileType.ECOLOGICAL_ZONE],
  [CardName.INDUSTRIAL_CENTER, TileType.INDUSTRIAL_CENTER],
  [CardName.LAVA_FLOWS, TileType.LAVA_FLOWS],
  [CardName.MINING_AREA, TileType.MINING_AREA],
  [CardName.MINING_RIGHTS, TileType.MINING_RIGHTS],
  [CardName.MOHOLE_AREA, TileType.MOHOLE_AREA],
  [CardName.NATURAL_PRESERVE, TileType.NATURAL_PRESERVE],
  [CardName.NUCLEAR_ZONE, TileType.NUCLEAR_ZONE],
  [CardName.RESTRICTED_AREA, TileType.RESTRICTED_AREA],
  [CardName.DEIMOS_DOWN_PROMO, TileType.DEIMOS_DOWN],
  [CardName.GREAT_DAM_PROMO, TileType.GREAT_DAM],
  [CardName.MAGNETIC_FIELD_GENERATORS_PROMO, TileType.MAGNETIC_FIELD_GENERATORS],
]);

/**
 * Resolves MarsBot bonus cards (B01–B08).
 */
export class MarsBotBonusResolver {
  private readonly tilePlacer: MarsBotTilePlacer;
  /** Callback to set the Neural Instance space on the MarsBot manager. */
  public onNeuralInstancePlaced: ((space: Space) => void) | undefined;

  /** Reference to the full MarsBot manager (set post-construction; needed for Colonies cards). */
  public marsBotManager: MarsBot | undefined;

  constructor(
    private readonly game: IGame,
    private readonly marsBot: IPlayer,
    private readonly humanPlayer: IPlayer,
    private readonly turnResolver: MarsBotTurnResolver,
    private readonly bonusDeck: MarsBotBonusDeck,
    tilePlacer: MarsBotTilePlacer,
  ) {
    this.tilePlacer = tilePlacer;
  }

  public resolve(card: MarsBotBonusDeckCard): boolean {
    if (card.id === undefined) {
      // A project card from the bonus deck is played, so it leaves the bonus deck
      this.turnResolver.resolveProjectCard(card);
      return false;
    }
    const destroyed = this.resolveEffect(card);
    // A card that returns to the action deck every generation waits outside the bonus deck
    if (!destroyed && this.marsBotManager?.returnsToActionDeck(card) !== true) {
      this.bonusDeck.discard(card);
    }
    return destroyed;
  }

  /**
   * Resolve a bonus card's effect.
   *
   * Returns true when the card must not be discarded: it was destroyed, or it went back into the bonus deck.
   */
  public resolveEffect(card: MarsBotBonusCard): boolean {
    switch (card.id) {
    case BonusCardId.B01_METEOR_SHOWER:
      return this.resolveMeteorShower();
    case BonusCardId.B02_INVASIVE_SPECIES:
      this.resolveInvasiveSpecies();
      return false;
    case BonusCardId.B03_RESEARCH_AND_DEVELOPMENT:
      this.resolveResearchAndDevelopment();
      return false;
    case BonusCardId.B04_OVERACHIEVEMENT:
      return this.resolveOverachievement();
    case BonusCardId.B05_EXPEDITED_CONSTRUCTION:
      return this.resolveExpeditedConstruction();
    case BonusCardId.B06_LOBBYISTS:
      return this.resolveLobbyists();
    case BonusCardId.B15_LOBBYISTS_VENUS:
      return this.resolveLobbyistsVenus();
    case BonusCardId.B16_GOVERNMENT_INTERVENTION:
      this.resolveGovernmentIntervention();
      return false;
    case BonusCardId.B07_LOCAL_NEURAL_INSTANCE:
      return this.resolveLocalNeuralInstance();
    case BonusCardId.B08_CORPORATE_COMPETITION:
      this.resolveCorporateCompetition();
      return false;

    // Colonies bonus cards (B17-B20)
    case BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES:
      return this.resolveExpeditedConstructionColonies();
    case BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD:
      this.resolveOuterSystemFoothold();
      return false;
    case BonusCardId.B19_SHIPPING_LINES:
      this.resolveShippingLines();
      return false;
    case BonusCardId.B20_EXTENDED_SHIPPING_LINES:
      this.resolveExtendedShippingLines();
      return false;

    // Turmoil bonus card
    case BonusCardId.B21_PARTY_POLITICS:
      this.resolvePartyPolitics();
      return false;

    // Corp-specific bonus cards (B22-B32)
    case BonusCardId.B22_SETTLERS:
      this.resolveSettlers();
      return false;
    case BonusCardId.B23_RAPID_SPROUTING:
      this.resolveRapidSprouting();
      return false;
    case BonusCardId.B24_SUPPLY_AND_DEMAND:
      this.resolveSupplyAndDemand();
      return false;
    case BonusCardId.B25_DO_IT_RIGHT:
      this.resolveDoItRight();
      return false;
    case BonusCardId.B26_VENUSIAN_LOBBY:
      this.resolveVenusianLobby();
      return false;
    case BonusCardId.B27_BUILD_BUILD_BUILD:
      return this.resolveBuildBuildBuild(card);
    case BonusCardId.B28_DIVERSIFICATION:
      this.resolveDiversification();
      return false;
    case BonusCardId.B29_GRAY_EMINENCE:
      this.resolveGrayEminence();
      return false;
    case BonusCardId.B30_INTERFACE_HYPERLINK:
      return this.resolveInterfaceHyperlink();
    case BonusCardId.B31_GOVERNMENT_SUBSIDY:
      this.resolveGovernmentSubsidy();
      return false;
    case BonusCardId.B32_INVESTORS:
      this.resolveInvestors();
      return false;
    }
    return false;
  }

  // B01: Meteor Shower
  private resolveMeteorShower(): boolean {
    // Asteroid Deflection System and Protected Habitat block plant removal
    if (this.humanPlayer.plantsAreProtected()) {
      this.game.log('MarsBot\'s Meteor Shower: blocked by plant protection');
      this.game.log('Meteor Shower is destroyed');
      return true;
    }
    const plantsLost = Math.min(5, this.humanPlayer.plants);
    if (plantsLost > 0) {
      this.humanPlayer.stock.deduct(Resource.PLANTS, plantsLost);
      this.game.log('MarsBot\'s Meteor Shower: ${0} loses ${1} plants', (b) => b.player(this.humanPlayer).number(plantsLost));
    }
    if (plantsLost >= 3) {
      this.game.log('Meteor Shower is destroyed');
      return true;
    }
    return false;
  }

  // B02: Invasive Species
  private resolveInvasiveSpecies(): void {
    this.maybeRemoveAnimalOrMicrobe('Invasive Species');
    // a. With Venus Next or Colonies, MarsBot gains 2 M€ and 1 floater; b. otherwise 5 M€
    const opts = this.game.gameOptions;
    if (opts.venusNextExtension || opts.coloniesExtension) {
      this.turnResolver.gainMc(2);
      this.turnResolver.gainFloaters(1);
      this.game.log('MarsBot gains 2 MC and 1 floater from Invasive Species');
    } else {
      this.turnResolver.gainMc(5);
      this.game.log('MarsBot gains 5 MC from Invasive Species');
    }
    // Card is NOT destroyed in base game
  }

  /**
   * Removes 1 animal or microbe from the player's highest-scoring card (Invasive Species, and
   * Corporate Competition's Excentric). False when no card has one MarsBot may remove.
   */
  private maybeRemoveAnimalOrMicrobe(source: string): boolean {
    // Protected Habitat blocks animal/microbe removal
    const isProtected = this.humanPlayer.playedCards.has(CardName.PROTECTED_HABITATS);

    // Find highest-scoring animal/microbe on human's cards
    let bestEntry: {card: IProjectCard, resource: CardResource, vp: number} | undefined;
    if (!isProtected) {
      for (const played of this.humanPlayer.playedCards) {
        // Pets and Bioengineering Enclosure protect their resources from opponents
        if (played.resourceCount && played.resourceCount > 0 && played.protectedResources !== true) {
          if (played.resourceType === CardResource.ANIMAL || played.resourceType === CardResource.MICROBE) {
            const vp = played.getVictoryPoints(this.humanPlayer);
            if (bestEntry === undefined || vp > bestEntry.vp) {
              bestEntry = {card: played as IProjectCard, resource: played.resourceType, vp};
            }
          }
        }
      }
    }
    if (bestEntry !== undefined) {
      const {card, resource} = bestEntry;
      if (card.resourceCount !== undefined) {
        card.resourceCount--;
      }
      this.game.log('MarsBot\'s ${0}: removed 1 ${1} from ${2}',
        (b) => b.rawString(source).rawString(resource).card(card));
      return true;
    }
    if (isProtected) {
      this.game.log('MarsBot\'s ${0}: blocked by Protected Habitats', (b) => b.rawString(source));
    } else {
      this.game.log('MarsBot\'s ${0}: no animal/microbe resources to remove', (b) => b.rawString(source));
    }
    return false;
  }

  // B03: Research and Development
  private resolveResearchAndDevelopment(): void {
    const drawnCard = this.game.projectDeck.draw(this.game);
    if (drawnCard !== undefined) {
      this.game.log('MarsBot draws and resolves ${0} (R&D)', (b) => b.card(drawnCard));
      this.turnResolver.resolveProjectCard(drawnCard);
    }
  }

  // B04: Overachievement
  private resolveOverachievement(): boolean {
    // Try to claim a milestone
    const claimable = this.game.milestones.filter((m) =>
      !this.game.milestoneClaimed(m) && !this.game.allMilestonesClaimed(),
    );
    let claimed = false;
    if (!this.game.allMilestonesClaimed()) {
      // Use MarsBot's track-based milestone criteria
      for (const m of claimable) {
        if (this.turnResolver.marsBotMeetsMilestone(m)) {
          this.game.claimedMilestones.push({player: this.marsBot, milestone: m});
          this.game.log('MarsBot claims milestone ${0} (Overachievement)', (b) => b.rawString(m.name));
          claimed = true;
          break;
        }
      }
    }

    if (!claimed && this.game.generation >= 6) {
      // Try to fund an award
      if (!this.game.allAwardsFunded()) {
        // Fund the award MarsBot leads by the most (ties go to the leftmost)
        const unfunded = this.game.awards.filter((a) => !this.game.hasBeenFunded(a));
        let best: {award: typeof unfunded[number], lead: number} | undefined;
        for (const a of unfunded) {
          const lead = this.turnResolver.getMarsBotAwardValue(a) - a.getScore(this.humanPlayer);
          if (lead > 0 && (best === undefined || lead > best.lead)) {
            best = {award: a, lead};
          }
        }
        if (best !== undefined) {
          const a = best.award;
          this.game.fundAward(this.marsBot, a);
          this.game.log('MarsBot funds award ${0} (Overachievement)', (b) => b.rawString(a.name));
          claimed = true;
        }
      }
    }

    if (claimed) {
      this.game.log('Overachievement is destroyed');
      return true;
    }
    this.turnResolver.gainMc(5);
    this.game.log('MarsBot gains 5 MC (Overachievement failed)');
    return false;
  }

  // B05: Expedited Construction
  private resolveExpeditedConstruction(): boolean {
    const space = this.tilePlacer.findExpeditedConstructionCitySpace();
    if (space !== undefined) {
      this.game.addCity(this.marsBot, space);
      this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(space));
      this.game.log('MarsBot places city (Expedited Construction), card destroyed');
      return true;
    }
    // No failed action if can't place
    return false;
  }

  // B06: Lobbyists / B15: Lobbyists (Venus) — shared (a) temp and (b) oxygen branches
  private resolveLobbyists(): boolean {
    if (this.lobbyistsTempBranch()) {
      return true;
    }
    if (this.lobbyistsOxygenBranch()) {
      return true;
    }

    // (c) B06: Ocean adjacent to 2+ oceans
    if (this.lobbyistsOceanBranch()) {
      return true;
    }

    this.advanceFurthestParameter();
    return false;
  }

  /** Lobbyists branch (c): an ocean space next to 2+ oceans takes an ocean. */
  private lobbyistsOceanBranch(source: string = 'Lobbyists'): boolean {
    const oceanSpaces = this.game.board.getAvailableSpacesForOcean(this.marsBot);
    const adjacentTo2Oceans = oceanSpaces.filter((s) => {
      const adj = this.game.board.getAdjacentSpaces(s);
      return adj.filter((a) => Board.isOceanSpace(a) && a.tile !== undefined).length >= 2;
    });
    if (adjacentTo2Oceans.length > 0 && this.game.canAddOcean()) {
      const space = adjacentTo2Oceans[0];
      if (this.interceptsRaise(GlobalParameter.OCEANS)) {
        this.game.log(`MarsBot skips the ocean (${source})`);
        return true;
      }
      this.game.addOcean(this.marsBot, space);
      this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(space));
      this.game.log(`MarsBot places ocean (${source})`);
      return true;
    }
    return false;
  }

  private resolveLobbyistsVenus(): boolean {
    if (this.lobbyistsTempBranch()) {
      return true;
    }
    if (this.lobbyistsOxygenBranch()) {
      return true;
    }

    // (c) B15: Venus 1-2 steps from bonus step or completion — do NOT destroy card
    const venus = this.game.getVenusScaleLevel();
    const venusBonusTargets = [constants.VENUS_LEVEL_FOR_CARD_BONUS, constants.VENUS_LEVEL_FOR_TR_BONUS, constants.MAX_VENUS_SCALE];
    const venusStepsToNextBonus = venusBonusTargets
      .filter((v) => v > venus)
      .map((v) => (v - venus) / 2)
      .reduce((min, s) => Math.min(min, s), Infinity);
    if (venusStepsToNextBonus >= 1 && venusStepsToNextBonus <= 2 && venus < constants.MAX_VENUS_SCALE) {
      if (!this.interceptsRaise(GlobalParameter.VENUS)) {
        this.game.increaseVenusScaleLevel(this.marsBot, 2);
        this.game.log('MarsBot raises Venus 2 steps (Lobbyists Venus)');
      }
      return false;
    }

    this.advanceFurthestParameter();
    return false;
  }

  /** Lobbyists shared branch (a): temperature 1-2 steps from bonus or completion. */
  private lobbyistsTempBranch(source: string = 'Lobbyists'): boolean {
    const temp = this.game.getTemperature();
    const tempBonusTargets = [constants.TEMPERATURE_BONUS_FOR_HEAT_1, constants.TEMPERATURE_BONUS_FOR_HEAT_2, constants.TEMPERATURE_FOR_OCEAN_BONUS, constants.MAX_TEMPERATURE];
    const tempStepsToNextBonus = tempBonusTargets
      .filter((t) => t > temp)
      .map((t) => (t - temp) / 2)
      .reduce((min, s) => Math.min(min, s), Infinity);
    if (tempStepsToNextBonus >= 1 && tempStepsToNextBonus <= 2 && temp < constants.MAX_TEMPERATURE) {
      if (!this.interceptsRaise(GlobalParameter.TEMPERATURE)) {
        this.game.increaseTemperature(this.marsBot, 2);
        this.game.log(`MarsBot raises temperature 2 steps (${source})`);
      }
      return true;
    }
    return false;
  }

  /** Lobbyists shared branch (b): oxygen 1-2 steps from bonus or completion. */
  private lobbyistsOxygenBranch(source: string = 'Lobbyists'): boolean {
    const oxy = this.game.getOxygenLevel();
    const oxyStepsToMax = constants.MAX_OXYGEN_LEVEL - oxy;
    const oxyBonusAt8 = oxy < constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS;
    const oxyStepsToBonus = oxyBonusAt8 ? constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS - oxy : oxyStepsToMax;
    if ((oxyStepsToMax >= 1 && oxyStepsToMax <= 2) || (oxyStepsToBonus >= 1 && oxyStepsToBonus <= 2)) {
      const greenerySpace = this.tilePlacer.findGreenerySpace();
      if (greenerySpace !== undefined) {
        const raiseOxygen = this.game.getOxygenLevel() >= constants.MAX_OXYGEN_LEVEL ||
          !this.interceptsRaise(GlobalParameter.OXYGEN);
        this.game.addGreenery(this.marsBot, greenerySpace, raiseOxygen);
        this.turnResolver.gainMc(this.tilePlacer.getPlacementBonusMC(greenerySpace) + this.tilePlacer.getOceanAdjacencyMC(greenerySpace));
        if (this.game.getOxygenLevel() < constants.MAX_OXYGEN_LEVEL && !this.interceptsRaise(GlobalParameter.OXYGEN)) {
          this.game.increaseOxygenLevel(this.marsBot, 1);
        }
        this.game.log(`MarsBot places greenery and raises oxygen twice (${source})`);
        return true;
      }
    }
    return false;
  }

  // B16: Government Intervention
  private resolveGovernmentIntervention(): void {
    const venus = this.game.getVenusScaleLevel();
    const isEvenGen = this.game.generation % 2 === 0;
    const venusComplete = venus >= constants.MAX_VENUS_SCALE;

    if (isEvenGen || venusComplete) {
      this.withoutTRorMcGain(() => this.advanceFurthestParameter(false));
    } else if (venus < constants.MAX_VENUS_SCALE) {
      this.withoutTRorMcGain(() => this.game.increaseVenusScaleLevel(this.marsBot, 1));
    }
  }

  /** Pristar: true when the corp consumes its cube to skip this raise. */
  private interceptsRaise(parameter: GlobalParameter): boolean {
    return this.marsBotManager?.interceptsParameterRaise(parameter) ?? false;
  }

  private turmoilHelper(): MarsBotTurmoilHelper {
    return new MarsBotTurmoilHelper(this.game);
  }

  /** Execute an action and reverse any TR or M€ gained (for Government Intervention). */
  private withoutTRorMcGain(action: () => void): void {
    const trBefore = this.marsBot.terraformRating;
    const mcBefore = this.turnResolver.megacredits;
    action();
    const trGained = this.marsBot.terraformRating - trBefore;
    if (trGained > 0) {
      this.marsBot.decreaseTerraformRating(trGained);
      this.game.log('MarsBot does not receive TR from Government Intervention');
    }
    if (this.turnResolver.megacredits > mcBefore) {
      this.turnResolver.megacredits = mcBefore;
      this.game.log('MarsBot does not receive M€ from Government Intervention');
    }
  }

  // B07: Local Neural Instance. The card is removed only once its tile is placed.
  private resolveLocalNeuralInstance(): boolean {
    const space = this.tilePlacer.findNeuralInstanceSpace();
    if (space !== undefined) {
      this.game.simpleAddTile(this.marsBot, space, {tileType: TileType.NEURAL_INSTANCE});
      this.game.automaHooks?.handleTilePlaced(this.marsBot, TileType.NEURAL_INSTANCE, space);
      this.onNeuralInstancePlaced?.(space);
      this.game.log('MarsBot places Neural Instance tile');
      this.game.log('Local Neural Instance is destroyed');
      return true;
    }
    // Can't place: draw and resolve a project card
    const drawnCard = this.game.projectDeck.draw(this.game);
    if (drawnCard !== undefined) {
      this.game.log('MarsBot draws and resolves ${0} (Neural Instance fallback)', (b) => b.card(drawnCard));
      this.turnResolver.resolveProjectCard(drawnCard);
    }
    return false;
  }

  // B08: Corporate Competition
  private resolveCorporateCompetition(): void {
    if (this.turnResolver.megacredits < 5) {
      // Not enough MC, draw another bonus card
      this.drawAndResolveAnotherBonus();
      return;
    }

    const funded = this.game.awards.filter((a) => this.game.hasBeenFunded(a));
    if (funded.length === 0) {
      this.drawAndResolveAnotherBonus();
      return;
    }

    // The closest award is the one the player leads by the least or is tied on. If MarsBot
    // leads every funded award, it is the one with the smallest gap.
    let resolved = false;
    const sorted = funded.map((a) => {
      const humanVal = a.getScore(this.humanPlayer);
      const marsBotVal = this.turnResolver.getMarsBotAwardValue(a);
      return {award: a, margin: humanVal - marsBotVal};
    }).sort((a, b) => {
      if ((a.margin >= 0) !== (b.margin >= 0)) {
        return a.margin >= 0 ? -1 : 1;
      }
      return Math.abs(a.margin) - Math.abs(b.margin);
    });

    for (const {award} of sorted) {
      if (this.tryHelperAction(award.name)) {
        this.turnResolver.megacredits -= 5;
        resolved = true;
        this.game.log('MarsBot resolves Corporate Competition on ${0}, loses 5 MC', (b) => b.rawString(award.name));
        break;
      }
    }

    if (!resolved) {
      this.drawAndResolveAnotherBonus();
    }
  }

  private tryHelperAction(awardName: string): boolean {
    const marsBotBoard = this.turnResolver.marsBotBoard;
    const board = this.game.board;
    const advance = (trackIndex: number) => {
      this.turnResolver.advanceTrack(trackIndex); return true;
    };
    const advanceTrackOf = (tag: Tag) => {
      const trackIndex = marsBotBoard.tagToTrack[tag];
      return trackIndex === undefined ? false : advance(trackIndex);
    };
    // Advances the less or the more advanced of two tags' tracks, the upper track when tied.
    const advanceTrackOfEither = (tags: [Tag, Tag], pick: 'less' | 'more') => {
      const position = (trackIndex: number) => marsBotBoard.tracks[trackIndex].position;
      const trackIndexes = tags.map((tag) => marsBotBoard.tagToTrack[tag])
        .filter((trackIndex) => trackIndex !== undefined)
        .sort((a, b) => a - b);
      if (trackIndexes.length === 0) {
        return false;
      }
      return advance(trackIndexes.reduce((best, trackIndex) => {
        const better = pick === 'less' ? position(trackIndex) < position(best) : position(trackIndex) > position(best);
        return better ? trackIndex : best;
      }));
    };
    const placeGreenery = (where?: (space: Space) => boolean) => {
      const space = this.tilePlacer.findGreenerySpace(where);
      if (space) {
        const raiseOxygen = this.game.getOxygenLevel() >= constants.MAX_OXYGEN_LEVEL ||
          !this.interceptsRaise(GlobalParameter.OXYGEN);
        this.game.addGreenery(this.marsBot, space, raiseOxygen);
        this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(space));
        return true;
      }
      return false;
    };
    const placeCity = (where?: (space: Space) => boolean) => {
      const space = this.tilePlacer.findCitySpace(where);
      if (space) {
        this.game.addCity(this.marsBot, space);
        this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(space));
        return true;
      }
      return false;
    };
    // Reveals cards until one passes `filter`, plays it, then gains `mc`.
    const revealAndResolveCard = (filter: (card: IProjectCard) => boolean, mc: number = 0) => {
      for (let i = 0; i < 20; i++) { // safety limit
        const card = this.game.projectDeck.draw(this.game);
        if (card === undefined) {
          return false;
        }
        if (filter(card)) {
          this.game.log('MarsBot reveals ${0} (Corporate Competition)', (b) => b.card(card));
          this.turnResolver.resolveProjectCard(card);
          this.turnResolver.gainMc(mc);
          return true;
        }
        this.game.projectDeck.discardPile.push(card);
      }
      return false;
    };
    const nextToOcean = (space: Space) => board.getAdjacentSpaces(space).some(Board.isOceanSpace);
    const nextToSpecialTile = (space: Space) => board.getAdjacentSpaces(space).some(isSpecialTileSpace);
    const onEdge = (space: Space) => board.getEdges().includes(space);
    const inFourBottomRows = (space: Space) => space.y >= 5 && space.y <= 8;

    switch (awardName) {
    // Tharsis (B08)
    case 'Landlord': return placeGreenery();
    case 'Banker': return advanceTrackOfEither([Tag.BUILDING, Tag.EVENT], 'less');
    case 'Scientist': return advanceTrackOf(Tag.SCIENCE);
    case 'Thermalist': return advanceTrackOf(Tag.POWER);
    case 'Miner': return advanceTrackOf(Tag.SPACE);
    // Hellas (B09)
    case 'Cultivator': return placeGreenery();
    case 'Magnate': return revealAndResolveCard((c) => c.type === CardType.AUTOMATED);
    case 'Space Baron': return advanceTrackOf(Tag.SPACE);
    case 'Excentric': return this.maybeRemoveAnimalOrMicrobe('Corporate Competition');
    case 'Contractor': return advanceTrackOf(Tag.BUILDING);
    // Elysium (B10)
    case 'Celebrity': return revealAndResolveCard((c) => c.cost >= 20);
    case 'Industrialist': return advanceTrackOf(Tag.POWER);
    case 'Desert Settler': return placeGreenery(inFourBottomRows);
    case 'Estate Dealer': return placeGreenery(nextToOcean);
    case 'Benefactor': { this.marsBot.increaseTerraformRating(2); return true; }
    // Utopia Planitia (B11). The board here has Edgedancer where the card has Suburbian.
    case 'Suburbian':
    case 'Edgedancer': return placeGreenery(onEdge);
    case 'Investor': return advanceTrackOf(Tag.EARTH);
    case 'Botanist': return advanceTrackOf(Tag.PLANT);
    case 'Incorporator': return revealAndResolveCard((c) => c.cost <= 10);
    case 'Metropolist': return placeCity();
    // Terra Cimmeria (B12)
    case 'Electrician': return advanceTrackOf(Tag.POWER);
    case 'Founder': return placeCity(nextToSpecialTile);
    case 'Mogul': return advance(marsBotBoard.getMostAdvancedTrackIndex());
    case 'A. Zoologist':
    case 'Zoologist': return advanceTrackOf(Tag.ANIMAL);
    case 'Forecaster': return revealAndResolveCard((c) => c.requirements.length > 0, 5);
    // Vastitas Borealis (B13). Traveller follows B14, the card for random awards.
    case 'Traveller': return advanceTrackOfEither([Tag.EARTH, Tag.JOVIAN], 'more');
    case 'Landscaper': return placeGreenery();
    case 'Highlander': return placeGreenery((space) => !nextToOcean(space));
    case 'Promoter': return advanceTrackOf(Tag.EVENT);
    case 'Blacksmith': return advanceTrackOfEither([Tag.BUILDING, Tag.SPACE], 'more');
    // Milestones and awards (B14)
    case 'Administrator': return revealAndResolveCard((c) => marsBotCardTags(c).length === 0, 5);
    case 'Biologist': return advanceTrackOf(Tag.MICROBE);
    case 'Collector': return advance(marsBotBoard.getLeastAdvancedTrackIndex());
    case 'Constructor': return placeCity();
    case 'Manufacturer': return advanceTrackOfEither([Tag.BUILDING, Tag.POWER], 'less');
    case 'Politician': return false;
    case 'Supplier': return advanceTrackOf(Tag.POWER);
    case 'Visionary': return advance(marsBotBoard.getLeastAdvancedTrackIndex(true));
    // Venus Next: added to ALL Corporate Competition variants
    case 'Venuphile': return advanceTrackOf(Tag.VENUS);
    default:
      return false;
    }
  }

  // B17: Expedited Construction (Colonies) — C-15
  private resolveExpeditedConstructionColonies(): boolean {
    // C-15a: Place city adjacent to ≥2 greenery/ocean tiles → destroy card
    const citySpace = this.tilePlacer.findExpeditedConstructionCitySpace();
    if (citySpace !== undefined) {
      this.game.addCity(this.marsBot, citySpace);
      this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(citySpace));
      this.game.log('MarsBot places city (Expedited Construction Colonies), card destroyed (C-15a)');
      return true;
    }

    // C-15b: If MarsBot has ≤1 colonies, place on a random eligible tile — do NOT destroy
    const marsBot = this.marsBotManager;
    if (marsBot !== undefined) {
      const colonyCount = this.game.colonies.filter((c) => c.colonies.includes(this.marsBot.id)).length;
      if (colonyCount <= 1) {
        const colony = selectRandomColony(this.game, marsBot);
        if (colony !== undefined) {
          placeColonyForMarsBot(colony, marsBot);
          this.game.log('MarsBot places colony (Expedited Construction Colonies, C-15b)');
          return false;
        }
      }
    }

    // C-15c: No effect
    this.game.log('MarsBot Expedited Construction Colonies: no effect (C-15c)');
    return false;
  }

  // B18: Outer System Foothold — C-16
  private resolveOuterSystemFoothold(): void {
    const marsBot = this.marsBotManager;
    if (marsBot === undefined) {
      this.game.log('MarsBot Outer System Foothold: no MarsBot manager available');
      return;
    }

    // C-16a/b: Place colony on randomly selected eligible tile
    const colony = selectRandomColony(this.game, marsBot);
    if (colony !== undefined) {
      placeColonyForMarsBot(colony, marsBot);
      this.game.log('MarsBot places colony via Outer System Foothold (C-16a/b)');
    } else {
      this.game.log('MarsBot Outer System Foothold: no eligible colony tile (C-16a)');
    }

    // C-16c/d: Draw from bonus deck (excluding B18 itself), discard without resolving
    // Temporarily remove B18 from discard so it isn't reshuffled back in
    const b18Idx = this.bonusDeck.discardPile.findIndex((c) => c.id === BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
    let b18Card: MarsBotBonusDeckCard | undefined;
    if (b18Idx >= 0) {
      [b18Card] = this.bonusDeck.discardPile.splice(b18Idx, 1);
    }
    const drawnBonus = this.bonusDeck.draw(this.game);
    if (b18Card !== undefined) {
      this.bonusDeck.discardPile.push(b18Card); // Restore B18
    }
    if (drawnBonus !== undefined) {
      this.bonusDeck.discard(drawnBonus);
      this.game.log('MarsBot draws and discards ${0} (Outer System Foothold, C-16c)', (b) => b.rawString(bonusCardDisplayName(drawnBonus)));
    }

    // The card itself (B18) is discarded by the caller after resolve() returns.
  }

  // B19: Shipping Lines / B20: Extended Shipping Lines — C-17
  private resolveShippingLines(): void {
    this.resolveTradeAction('Shipping Lines');
  }

  private resolveExtendedShippingLines(): void {
    this.resolveTradeAction('Extended Shipping Lines');
  }

  private resolveTradeAction(cardName: string): void {
    const marsBot = this.marsBotManager;
    if (marsBot === undefined) {
      this.game.log(`MarsBot ${cardName}: no MarsBot manager available`);
      return;
    }

    const colony = selectTradeColony(this.game, marsBot);
    if (colony === undefined) {
      // No tradeable colony: Failed Action
      this.turnResolver.failedAction();
      this.game.log(`MarsBot ${cardName}: no tradeable colony — Failed Action (C-17)`);
      return;
    }

    tradeWithColony(marsBot, colony);
    this.game.log(`MarsBot resolves ${cardName} (C-17)`);
  }

  private drawAndResolveAnotherBonus(): void {
    const nextBonus = this.bonusDeck.draw(this.game);
    if (nextBonus !== undefined) {
      this.game.log('MarsBot draws another bonus card: ${0}', (b) => b.rawString(bonusCardDisplayName(nextBonus)));
      this.resolve(nextBonus);
    }
    // Both cards are discarded (original was already discarded by caller)
  }

  /** Advance the global parameter furthest from completion. Tie: oxygen > ocean > temperature. */
  private advanceFurthestParameter(allowCorpIntercept: boolean = true): void {
    const tempProgress = (this.game.getTemperature() - constants.MIN_TEMPERATURE) /
      (constants.MAX_TEMPERATURE - constants.MIN_TEMPERATURE);
    const oxyProgress = this.game.getOxygenLevel() / constants.MAX_OXYGEN_LEVEL;
    const oceanSpaces = this.game.board.getOceanSpaces().length;
    const oceanProgress = oceanSpaces / constants.MAX_OCEAN_TILES;

    const params: Array<{name: string, progress: number, action: () => boolean}> = [
      {name: 'oxygen', progress: oxyProgress, action: () => {
        if (this.game.getOxygenLevel() < constants.MAX_OXYGEN_LEVEL) {
          if (allowCorpIntercept && this.interceptsRaise(GlobalParameter.OXYGEN)) {
            return true;
          }
          this.game.increaseOxygenLevel(this.marsBot, 1);
          return true;
        }
        return false;
      }},
      {name: 'ocean', progress: oceanProgress, action: () => {
        if (this.game.canAddOcean()) {
          const space = this.tilePlacer.findOceanSpace();
          if (space) {
            if (allowCorpIntercept && this.interceptsRaise(GlobalParameter.OCEANS)) {
              return true;
            }
            this.game.addOcean(this.marsBot, space);
            this.turnResolver.gainMc(this.tilePlacer.getPlacementBonusMC(space) + this.tilePlacer.getOceanAdjacencyMC(space));
            return true;
          }
        }
        return false;
      }},
      {name: 'temperature', progress: tempProgress, action: () => {
        if (this.game.getTemperature() < constants.MAX_TEMPERATURE) {
          if (allowCorpIntercept && this.interceptsRaise(GlobalParameter.TEMPERATURE)) {
            return true;
          }
          this.game.increaseTemperature(this.marsBot, 1);
          return true;
        }
        return false;
      }},
    ];

    // Sort by progress ascending (furthest from completion first), tie order preserved (oxy > ocean > temp)
    params.sort((a, b) => a.progress - b.progress);

    for (const p of params) {
      if (p.action()) {
        this.game.log('MarsBot advances ${0} (furthest from completion)', (b) => b.rawString(p.name));
        return;
      }
    }
  }

  // ---- Corp-Specific Bonus Cards (B22-B32) ----

  private resolvePlaceGreeneryCard(cardName: string): void {
    this.turnResolver.placeGreenery();
    this.game.log(`MarsBot resolves ${cardName}: placed greenery`);
  }

  // Arcadian Communities: a player marker, not a tile, on a space that is not reserved
  private resolveSettlers(): void {
    const space = this.tilePlacer.findMarkerSpace();
    if (space === undefined || this.marsBotManager === undefined) {
      this.game.log('MarsBot resolves Settlers: no space left for a player marker');
      return;
    }
    this.marsBotManager.placeMarker(space);
  }

  // Ecoline: a. spend the plant on the corp card to place a greenery; b. otherwise put a plant there
  private resolveRapidSprouting(): void {
    const bot = this.marsBotManager;
    if (bot === undefined) {
      return;
    }
    if (bot.getCorpState('plantOnCard') > 0) {
      bot.setCorpState('plantOnCard', 0);
      this.resolvePlaceGreeneryCard('Rapid Sprouting');
    } else {
      bot.setCorpState('plantOnCard', 1);
      this.game.log('MarsBot resolves Rapid Sprouting: 1 plant on the corporation card');
    }
  }

  // Factorum: take up to 3 M€ from the corp card; with none taken, advance the energy track
  private resolveSupplyAndDemand(): void {
    const bot = this.marsBotManager;
    const taken = Math.min(3, bot?.getCorpState('mcOnCard') ?? 0);
    if (bot !== undefined && taken > 0) {
      bot.setCorpState('mcOnCard', bot.getCorpState('mcOnCard') - taken);
      this.turnResolver.gainMc(taken);
      this.game.log('MarsBot resolves Supply & Demand: takes ${0} M€ from the corporation card', (b) => b.number(taken));
    } else {
      this.turnResolver.advanceTrack(4);
      this.game.log('MarsBot resolves Supply & Demand: advance energy track');
    }
  }

  // Inventrix: the first of Lobbyists' temperature, oxygen and ocean branches that applies
  private resolveDoItRight(): void {
    if (this.lobbyistsTempBranch('Do It Right') ||
      this.lobbyistsOxygenBranch('Do It Right') ||
      this.lobbyistsOceanBranch('Do It Right')) {
      return;
    }
    this.game.log('MarsBot resolves Do It Right: no effect');
  }

  private resolveVenusianLobby(): void {
    if (this.game.gameOptions.venusNextExtension) {
      // Morningstar: raise Venus 1 step and advance the Venus track (index 7), then raise the
      // global parameter furthest from its maximum
      if (this.game.getVenusScaleLevel() < constants.MAX_VENUS_SCALE && !this.interceptsRaise(GlobalParameter.VENUS)) {
        this.game.increaseVenusScaleLevel(this.marsBot, 1);
      }
      if (this.turnResolver.marsBotBoard.tracks.length > 7) {
        this.turnResolver.advanceTrack(7);
      }
      this.game.log('MarsBot resolves Venusian Lobby: raise Venus, advance Venus track');
      this.advanceFurthestParameter();
    } else {
      // Without Venus, advance least-advanced track
      const leastIdx = this.turnResolver.marsBotBoard.getLeastAdvancedTrackIndex();
      this.turnResolver.advanceTrack(leastIdx);
      this.game.log('MarsBot resolves Venusian Lobby: advance least-advanced track (no Venus)');
    }
  }

  // Philares: a. a city next to the player's greenery, then lose 5 M€; b. the special tile of a
  // card MarsBot played next to the player's city, then lose that card and 3 M€; c. gain 3 M€
  // and shuffle this card back into the bonus deck
  private resolveBuildBuildBuild(card: MarsBotBonusCard): boolean {
    const citySpace = this.tilePlacer.findCitySpaceNextToHumanGreenery();
    if (citySpace !== undefined) {
      this.game.addCity(this.marsBot, citySpace);
      this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(citySpace));
      const lost = this.loseMc(5);
      this.game.log('MarsBot resolves Build Build Build: city next to the player\'s greenery, loses ${0} M€', (b) => b.number(lost));
      return false;
    }

    const bot = this.marsBotManager;
    const played = bot?.playedProjectCards.find((c) => SPECIAL_TILES.has(c.name));
    const tileType = played === undefined ? undefined : SPECIAL_TILES.get(played.name);
    const specialSpace = tileType === undefined ? undefined : this.tilePlacer.findSpecialTileSpaceNextToHumanCity();
    if (bot !== undefined && played !== undefined && tileType !== undefined && specialSpace !== undefined) {
      this.game.addTile(this.marsBot, specialSpace, {tileType, card: played.name});
      this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(specialSpace));
      inplaceRemove(bot.playedProjectCards, played);
      inplaceRemoveIf(this.game.projectDeck.discardPile, (c) => c.name === played.name);
      const lost = this.loseMc(3);
      this.game.log('MarsBot resolves Build Build Build: ${0} tile next to the player\'s city, removes the card and loses ${1} M€',
        (b) => b.card(played).number(lost));
      return false;
    }

    this.turnResolver.gainMc(3);
    this.bonusDeck.drawPile.push(card);
    inplaceShuffle(this.bonusDeck.drawPile, this.game.rng);
    this.game.log('MarsBot resolves Build Build Build: +3 M€, card shuffled back into the bonus deck');
    return true;
  }

  /** Takes up to `amount` M€ from MarsBot and returns how much it lost. */
  private loseMc(amount: number): number {
    const lost = Math.min(amount, this.turnResolver.megacredits);
    this.turnResolver.megacredits -= lost;
    return lost;
  }

  private resolveDiversification(): void {
    // Robinson Industries: advance least-advanced track, then lose up to 4 M€
    const marsBotBoard = this.turnResolver.marsBotBoard;
    const leastIndex = marsBotBoard.getLeastAdvancedTrackIndex();
    this.turnResolver.advanceTrack(leastIndex);
    const lost = Math.min(4, this.turnResolver.megacredits);
    this.turnResolver.megacredits -= lost;
    this.game.log('MarsBot resolves Diversification: advance least-advanced track, lose ${0} M€', (b) => b.number(lost));
  }

  // B21: Party Politics (T-7, T-8)
  private resolvePartyPolitics(): void {
    const turmoil = this.game.turmoil;
    if (turmoil === undefined) {
      this.game.log('MarsBot resolves Party Politics: Turmoil not active');
      return;
    }
    // T-7: Place 1 delegate from reserve using the priority list
    const placed = this.turmoilHelper().maybePlaceDelegate();
    if (placed === undefined) {
      this.game.log('MarsBot resolves Party Politics: no delegates in reserve');
      return;
    }

    // T-8: If ≥1 delegate still in reserve AND MarsBot has ≥5 MC:
    //       flip a project deck card — if its cost is divisible by 3, spend 5 MC and place another delegate
    if (turmoil.hasDelegatesInReserve(this.marsBot) && this.turnResolver.megacredits >= 5) {
      const flipped = this.game.projectDeck.draw(this.game);
      if (flipped !== undefined) {
        this.game.log('MarsBot flips ${0} (cost ${1}) for Party Politics T-8 check', (b) => b.card(flipped).number(flipped.cost));
        this.game.projectDeck.discardPile.push(flipped);
        if (flipped.cost % 3 === 0) {
          this.turnResolver.megacredits -= 5;
          this.game.log('MarsBot spends 5 M€ to place a second delegate (Party Politics T-8)');
          this.turmoilHelper().maybePlaceDelegate();
        }
      }
    }
  }

  // B29: Gray Eminence (Septem Tribus — T-7 delegate placement, no T-8 repeat)
  private resolveGrayEminence(): void {
    const turmoil = this.game.turmoil;
    if (turmoil === undefined) {
      this.game.log('MarsBot resolves Gray Eminence: Turmoil not active');
      return;
    }
    // Up to 2 delegates, each to the party with the fewest MarsBot delegates, then the fewest
    // player delegates, then a random one. 2 M€ for each delegate it can't place.
    for (let i = 0; i < 2; i++) {
      if (!turmoil.hasDelegatesInReserve(this.marsBot)) {
        this.turnResolver.gainMc(2);
        this.game.log('MarsBot resolves Gray Eminence: no delegate in reserve, +2 M€');
        continue;
      }
      const partyName = this.turmoilHelper().selectGrayEminenceParty();
      turmoil.sendDelegateToParty(this.marsBot, partyName, this.game);
      this.game.log('MarsBot places delegate in ${0} (Gray Eminence)', (b) => b.partyName(partyName));
    }
  }

  // B30: Interface Hyperlink (Tycho Magnetics): draw 1 card per space of the energy track, play
  // the 2 best and discard the rest. The card is destroyed once it plays a card.
  private resolveInterfaceHyperlink(): boolean {
    const marsBotBoard = this.turnResolver.marsBotBoard;
    const energyTrack = marsBotBoard.tagToTrack[Tag.POWER];
    const count = energyTrack === undefined ? 0 : marsBotBoard.tracks[energyTrack].position;
    const drawn = this.game.projectDeck.drawN(this.game, count);
    if (drawn.length === 0) {
      this.game.log('MarsBot resolves Interface Hyperlink: no cards to draw');
      return false;
    }
    // Science cards first, then the most expensive, then the most tags, then at random
    const science = (card: IProjectCard) => marsBotCardTags(card).includes(Tag.SCIENCE) ? 1 : 0;
    const tagCount = (card: IProjectCard) => marsBotCardTags(card).filter((tag) => tag !== Tag.WILD).length;
    inplaceShuffle(drawn, this.game.rng);
    drawn.sort((a, b) => science(b) - science(a) || b.cost - a.cost || tagCount(b) - tagCount(a));
    const discarded = drawn.splice(2);
    this.game.projectDeck.discard(...discarded);
    for (const card of drawn) {
      this.game.log('MarsBot draws and resolves ${0} (Interface Hyperlink)', (b) => b.card(card));
      this.turnResolver.resolveProjectCard(card);
    }
    this.game.log('Interface Hyperlink is destroyed');
    return true;
  }

  private resolveGovernmentSubsidy(): void {
    // UNMI: raise TR 1 step
    this.marsBot.increaseTerraformRating(1);
    this.game.log('MarsBot resolves Government Subsidy: +1 TR');
  }

  private resolveInvestors(): void {
    // Utopia Invest: a. in an even generation, advance the least-advanced track and move the
    // most-advanced track back 1 space; b. otherwise gain 1 M€ per space of the least-advanced
    // track. Ties go to the upper track.
    const marsBotBoard = this.turnResolver.marsBotBoard;
    const leastIndex = marsBotBoard.getLeastAdvancedTrackIndex();
    if (this.game.generation % 2 === 0) {
      const mostIndex = marsBotBoard.getMostAdvancedTrackIndex();
      this.turnResolver.advanceTrack(leastIndex);
      marsBotBoard.tracks[mostIndex].regress();
      this.game.log('MarsBot resolves Investors: advance least-advanced track, move most-advanced track back');
    } else {
      const amount = marsBotBoard.tracks[leastIndex].position;
      this.turnResolver.gainMc(amount);
      this.game.log('MarsBot resolves Investors: +${0} M€ (least-advanced track)', (b) => b.number(amount));
    }
  }
}
