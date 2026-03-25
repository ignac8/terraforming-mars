import {BonusCardId} from '../../common/automa/AutomaTypes';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {CardResource} from '../../common/CardResource';
import {TileType} from '../../common/TileType';
import {Board} from '../boards/Board';
import * as constants from '../../common/constants';
import {MarsBotBonusCard} from './MarsBotBonusCard';
import {MarsBotBonusDeck} from './MarsBotBonusDeck';
import {MarsBotTilePlacer} from './MarsBotTilePlacer';
import {MarsBotTurnResolver} from './MarsBotTurnResolver';
import {IProjectCard} from '../cards/IProjectCard';
import {Space} from '../boards/Space';

/**
 * Resolves MarsBot bonus cards (B01–B08).
 */
export class MarsBotBonusResolver {
  private readonly tilePlacer: MarsBotTilePlacer;
  /** Callback to set the Neural Instance space on the MarsBot manager. */
  public onNeuralInstancePlaced: ((space: Space) => void) | undefined;

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

  public resolve(card: MarsBotBonusCard): void {
    switch (card.id) {
    case BonusCardId.B01_METEOR_SHOWER:
      this.resolveMeteorShower(card);
      break;
    case BonusCardId.B02_INVASIVE_SPECIES:
      this.resolveInvasiveSpecies(card);
      break;
    case BonusCardId.B03_RESEARCH_AND_DEVELOPMENT:
      this.resolveResearchAndDevelopment(card);
      break;
    case BonusCardId.B04_OVERACHIEVEMENT:
      this.resolveOverachievement(card);
      break;
    case BonusCardId.B05_EXPEDITED_CONSTRUCTION:
      this.resolveExpeditedConstruction(card);
      break;
    case BonusCardId.B06_LOBBYISTS:
      this.resolveLobbyists(card);
      break;
    case BonusCardId.B07_LOCAL_NEURAL_INSTANCE:
      this.resolveLocalNeuralInstance(card);
      break;
    case BonusCardId.B08_CORPORATE_COMPETITION:
      this.resolveCorporateCompetition(card);
      break;

    // Corp-specific bonus cards (B22-B32)
    case BonusCardId.B22_SETTLERS:
      this.resolveSettlers();
      break;
    case BonusCardId.B23_RAPID_SPROUTING:
      this.resolveRapidSprouting();
      break;
    case BonusCardId.B24_SUPPLY_AND_DEMAND:
      this.resolveSupplyAndDemand();
      break;
    case BonusCardId.B25_DO_IT_RIGHT:
      this.resolveDoItRight();
      break;
    case BonusCardId.B26_VENUSIAN_LOBBY:
      this.resolveVenusianLobby();
      break;
    case BonusCardId.B27_BUILD_BUILD_BUILD:
      this.resolveBuildBuildBuild();
      break;
    case BonusCardId.B28_DIVERSIFICATION:
      this.resolveDiversification();
      break;
    case BonusCardId.B29_GRAY_EMINENCE:
      this.resolveGrayEminence();
      break;
    case BonusCardId.B30_INTERFACE_HYPERLINK:
      this.resolveInterfaceHyperlink();
      break;
    case BonusCardId.B31_GOVERNMENT_SUBSIDY:
      this.resolveGovernmentSubsidy();
      break;
    case BonusCardId.B32_INVESTORS:
      this.resolveInvestors();
      break;
    }

    this.bonusDeck.discard(card);
  }

  // B01: Meteor Shower
  private resolveMeteorShower(card: MarsBotBonusCard): void {
    const plantsLost = Math.min(5, this.humanPlayer.plants);
    if (plantsLost > 0) {
      this.humanPlayer.stock.deduct(Resource.PLANTS, plantsLost);
      this.game.log('MarsBot\'s Meteor Shower: ${0} loses ${1} plants', (b) => b.player(this.humanPlayer).number(plantsLost));
    }
    if (plantsLost >= 3) {
      this.bonusDeck.destroy(card);
      this.game.log('Meteor Shower is destroyed');
    }
  }

  // B02: Invasive Species
  private resolveInvasiveSpecies(_card: MarsBotBonusCard): void {
    // Find highest-scoring animal/microbe on human's cards
    let bestEntry: {card: IProjectCard, resource: CardResource, vp: number} | undefined;
    for (const played of this.humanPlayer.playedCards) {
      if (played.resourceCount && played.resourceCount > 0) {
        if (played.resourceType === CardResource.ANIMAL || played.resourceType === CardResource.MICROBE) {
          const vp = played.getVictoryPoints(this.humanPlayer);
          if (bestEntry === undefined || vp > bestEntry.vp) {
            bestEntry = {card: played as IProjectCard, resource: played.resourceType, vp};
          }
        }
      }
    }
    if (bestEntry !== undefined) {
      bestEntry.card.resourceCount!--;
      this.game.log('MarsBot\'s Invasive Species: removed 1 ${0} from ${1}',
        (b) => b.rawString(bestEntry!.resource).card(bestEntry!.card));
    }
    // MarsBot gains 5 MC regardless
    this.turnResolver.mcSupply += 5;
    this.game.log('MarsBot gains 5 MC from Invasive Species');
    // Card is NOT destroyed in base game
  }

  // B03: Research and Development
  private resolveResearchAndDevelopment(_card: MarsBotBonusCard): void {
    const drawnCard = this.game.projectDeck.draw(this.game);
    if (drawnCard !== undefined) {
      this.game.log('MarsBot draws and resolves ${0} (R&D)', (b) => b.card(drawnCard));
      this.turnResolver.resolveProjectCard(drawnCard);
    }
  }

  // B04: Overachievement
  private resolveOverachievement(card: MarsBotBonusCard): void {
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
        const unfunded = this.game.awards.filter((a) => !this.game.hasBeenFunded(a));
        for (const a of unfunded) {
          const marsBotVal = this.turnResolver.getMarsBotAwardValue(a);
          const humanVal = a.getScore(this.humanPlayer);
          if (marsBotVal > humanVal) {
            this.game.fundAward(this.marsBot, a);
            this.game.log('MarsBot funds award ${0} (Overachievement)', (b) => b.rawString(a.name));
            claimed = true;
            break;
          }
        }
      }
    }

    if (claimed) {
      this.bonusDeck.destroy(card);
      this.game.log('Overachievement is destroyed');
    } else {
      this.turnResolver.mcSupply += 5;
      this.game.log('MarsBot gains 5 MC (Overachievement failed)');
    }
  }

  // B05: Expedited Construction
  private resolveExpeditedConstruction(card: MarsBotBonusCard): void {
    const space = this.tilePlacer.findExpediteConstructionCitySpace();
    if (space !== undefined) {
      this.game.addCity(this.marsBot, space);
      this.turnResolver.mcSupply += this.tilePlacer.getTotalPlacementMC(space);
      this.bonusDeck.destroy(card);
      this.game.log('MarsBot places city (Expedited Construction), card destroyed');
    }
    // No failed action if can't place
  }

  // B06: Lobbyists
  private resolveLobbyists(card: MarsBotBonusCard): void {
    const temp = this.game.getTemperature();
    const oxy = this.game.getOxygenLevel();

    // (a) Temperature 1-2 steps from bonus step or completion
    // Bonus steps: -24°C, -20°C (heat production), 0°C (ocean), and completion (+8°C)
    const tempBonusTargets = [constants.TEMPERATURE_BONUS_FOR_HEAT_1, constants.TEMPERATURE_BONUS_FOR_HEAT_2, constants.TEMPERATURE_FOR_OCEAN_BONUS, constants.MAX_TEMPERATURE];
    const tempStepsToNextBonus = tempBonusTargets
      .filter((t) => t > temp)
      .map((t) => (t - temp) / 2)
      .reduce((min, s) => Math.min(min, s), Infinity);
    if (tempStepsToNextBonus >= 1 && tempStepsToNextBonus <= 2 && temp < constants.MAX_TEMPERATURE) {
      this.game.increaseTemperature(this.marsBot, 2);
      this.bonusDeck.destroy(card);
      this.game.log('MarsBot raises temperature 2 steps (Lobbyists), card destroyed');
      return;
    }

    // (b) Oxygen 1-2 steps from bonus or completion
    const oxyStepsToMax = constants.MAX_OXYGEN_LEVEL - oxy;
    const oxyBonusAt8 = oxy < constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS;
    const oxyStepsToBonus = oxyBonusAt8 ? constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS - oxy : oxyStepsToMax;
    if ((oxyStepsToMax >= 1 && oxyStepsToMax <= 2) || (oxyStepsToBonus >= 1 && oxyStepsToBonus <= 2)) {
      // Place greenery + raise oxygen + raise oxygen 1 more
      const greenerySpace = this.tilePlacer.findGreenerySpace();
      if (greenerySpace !== undefined) {
        this.game.addGreenery(this.marsBot, greenerySpace, true);
        this.turnResolver.mcSupply += this.tilePlacer.getPlacementBonusMC(greenerySpace);
        this.turnResolver.mcSupply += this.tilePlacer.getOceanAdjacencyMC(greenerySpace);
        // Raise oxygen 1 more step
        if (this.game.getOxygenLevel() < constants.MAX_OXYGEN_LEVEL) {
          this.game.increaseOxygenLevel(this.marsBot, 1);
        }
        this.bonusDeck.destroy(card);
        this.game.log('MarsBot places greenery and raises oxygen twice (Lobbyists), card destroyed');
        return;
      }
    }

    // (c) Ocean space adjacent to 2+ oceans
    const oceanSpaces = this.game.board.getAvailableSpacesForOcean(this.marsBot);
    const adjacentTo2Oceans = oceanSpaces.filter((s) => {
      const adj = this.game.board.getAdjacentSpaces(s);
      return adj.filter((a) => Board.isOceanSpace(a) && a.tile !== undefined).length >= 2;
    });
    if (adjacentTo2Oceans.length > 0 && this.game.canAddOcean()) {
      const space = adjacentTo2Oceans[0]; // Simplified: take first
      this.game.addOcean(this.marsBot, space);
      this.turnResolver.mcSupply += this.tilePlacer.getTotalPlacementMC(space);
      this.bonusDeck.destroy(card);
      this.game.log('MarsBot places ocean (Lobbyists), card destroyed');
      return;
    }

    // (d) Advance furthest-from-completion parameter (tie: oxygen > ocean > temperature)
    this.advanceFurthestParameter();
  }

  // B07: Local Neural Instance
  private resolveLocalNeuralInstance(card: MarsBotBonusCard): void {
    const space = this.tilePlacer.findNeuralInstanceSpace();
    if (space !== undefined) {
      this.game.simpleAddTile(this.marsBot, space, {tileType: TileType.NEURAL_INSTANCE});
      this.onNeuralInstancePlaced?.(space);
      this.game.log('MarsBot places Neural Instance tile');
    } else {
      // Can't place: draw and resolve a project card
      const drawnCard = this.game.projectDeck.draw(this.game);
      if (drawnCard !== undefined) {
        this.game.log('MarsBot draws and resolves ${0} (Neural Instance fallback)', (b) => b.card(drawnCard));
        this.turnResolver.resolveProjectCard(drawnCard);
      }
    }
    this.bonusDeck.destroy(card);
    this.game.log('Local Neural Instance is destroyed');
  }

  // B08: Corporate Competition
  private resolveCorporateCompetition(card: MarsBotBonusCard): void {
    if (this.turnResolver.mcSupply < 5) {
      // Not enough MC, draw another bonus card
      this.drawAndResolveAnotherBonus(card);
      return;
    }

    const funded = this.game.awards.filter((a) => this.game.hasBeenFunded(a));
    if (funded.length === 0) {
      this.drawAndResolveAnotherBonus(card);
      return;
    }

    // Find closest funded award (smallest margin human leads by, or smallest margin MarsBot leads by)
    let resolved = false;
    const sorted = funded.map((a) => {
      const humanVal = a.getScore(this.humanPlayer);
      const marsBotVal = this.turnResolver.getMarsBotAwardValue(a);
      return {award: a, margin: humanVal - marsBotVal};
    }).sort((a, b) => a.margin - b.margin); // Smallest margin first (MarsBot most competitive)

    for (const {award} of sorted) {
      if (this.tryHelperAction(award.name)) {
        this.turnResolver.mcSupply -= 5;
        resolved = true;
        this.game.log('MarsBot resolves Corporate Competition on ${0}, loses 5 MC', (b) => b.rawString(award.name));
        break;
      }
    }

    if (!resolved) {
      this.drawAndResolveAnotherBonus(card);
    }
  }

  private tryHelperAction(awardName: string): boolean {
    switch (awardName) {
    case 'Landlord': {
      const space = this.tilePlacer.findGreenerySpace();
      if (space) {
        this.game.addGreenery(this.marsBot, space, true);
        this.turnResolver.mcSupply += this.tilePlacer.getPlacementBonusMC(space);
        this.turnResolver.mcSupply += this.tilePlacer.getOceanAdjacencyMC(space);
        return true;
      }
      return false;
    }
    case 'Banker': {
      // Advance track 1 or track 3, whichever is least advanced (track 1 if tied)
      const t1 = this.turnResolver.board.getTrack(1);
      const t3 = this.turnResolver.board.getTrack(3);
      const track = t1.position <= t3.position ? 1 : 3;
      this.turnResolver.advanceTrackPublic(track - 1);
      return true;
    }
    case 'Scientist':
      this.turnResolver.advanceTrackPublic(3);
      return true;
    case 'Thermalist':
      this.turnResolver.advanceTrackPublic(4);
      return true;
    case 'Miner':
      this.turnResolver.advanceTrackPublic(1);
      return true;
    default:
      return false;
    }
  }

  private drawAndResolveAnotherBonus(_originalCard: MarsBotBonusCard): void {
    const nextBonus = this.bonusDeck.draw();
    if (nextBonus !== undefined) {
      this.game.log('MarsBot draws another bonus card: ${0}', (b) => b.rawString(nextBonus.name));
      this.resolve(nextBonus);
    }
    // Both cards are discarded (original was already discarded by caller)
  }

  /** Advance the global parameter furthest from completion. Tie: oxygen > ocean > temperature. */
  private advanceFurthestParameter(): void {
    const tempProgress = (this.game.getTemperature() - constants.MIN_TEMPERATURE) /
      (constants.MAX_TEMPERATURE - constants.MIN_TEMPERATURE);
    const oxyProgress = this.game.getOxygenLevel() / constants.MAX_OXYGEN_LEVEL;
    const oceanSpaces = this.game.board.getOceanSpaces().length;
    const oceanProgress = oceanSpaces / constants.MAX_OCEAN_TILES;

    const params: Array<{name: string, progress: number, action: () => boolean}> = [
      {name: 'oxygen', progress: oxyProgress, action: () => {
        if (this.game.getOxygenLevel() < constants.MAX_OXYGEN_LEVEL) {
          this.game.increaseOxygenLevel(this.marsBot, 1);
          return true;
        }
        return false;
      }},
      {name: 'ocean', progress: oceanProgress, action: () => {
        if (this.game.canAddOcean()) {
          const space = this.tilePlacer.findOceanSpace();
          if (space) {
            this.game.addOcean(this.marsBot, space);
            this.turnResolver.mcSupply += this.tilePlacer.getPlacementBonusMC(space);
            this.turnResolver.mcSupply += this.tilePlacer.getOceanAdjacencyMC(space);
            return true;
          }
        }
        return false;
      }},
      {name: 'temperature', progress: tempProgress, action: () => {
        if (this.game.getTemperature() < constants.MAX_TEMPERATURE) {
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

  private resolveSettlers(): void {
    this.resolvePlaceGreeneryCard('Settlers');
  }

  private resolveRapidSprouting(): void {
    this.resolvePlaceGreeneryCard('Rapid Sprouting');
  }

  private resolveSupplyAndDemand(): void {
    // Factorum: advance building track (index 0)
    this.turnResolver.advanceTrackPublic(0);
    this.game.log('MarsBot resolves Supply & Demand: advance building track');
  }

  private resolveDoItRight(): void {
    // Inventrix: advance science track (index 3)
    this.turnResolver.advanceTrackPublic(3);
    this.game.log('MarsBot resolves Do It Right: advance science track');
  }

  private resolveVenusianLobby(): void {
    if (this.game.gameOptions.venusNextExtension) {
      // Venus track is track 8 (index 7) when Venus expansion is enabled
      // If Venus track exists on the board, advance it
      if (this.turnResolver.board.tracks.length > 7) {
        this.turnResolver.advanceTrackPublic(7);
        this.game.log('MarsBot resolves Venusian Lobby: advance Venus track');
      } else {
        this.game.log('MarsBot resolves Venusian Lobby: no Venus track available');
      }
    } else {
      // Without Venus, advance least-advanced track
      const leastIdx = this.turnResolver.board.getLeastAdvancedTrackIndex();
      this.turnResolver.advanceTrackPublic(leastIdx);
      this.game.log('MarsBot resolves Venusian Lobby: advance least-advanced track (no Venus)');
    }
  }

  private resolveBuildBuildBuild(): void {
    // Philares: place city tile
    this.turnResolver.placeCity();
    this.game.log('MarsBot resolves Build Build Build: placed city');
  }

  private resolveDiversification(): void {
    // Robinson Industries: advance least-advanced track
    const board = this.turnResolver.board;
    const leastIndex = board.getLeastAdvancedTrackIndex();
    this.turnResolver.advanceTrackPublic(leastIndex);
    this.game.log('MarsBot resolves Diversification: advance least-advanced track');
  }

  private resolveGrayEminence(): void {
    // Septem Tribus: place delegate (Turmoil)
    // Turmoil not yet supported — gain 5 MC as placeholder
    this.turnResolver.mcSupply += 5;
    this.game.log('MarsBot resolves Gray Eminence: +5 M€ (Turmoil delegate placement not yet implemented)');
  }

  private resolveInterfaceHyperlink(): void {
    // Tyco Magnetics: advance energy (index 4) or science (index 3) track — whichever is least advanced
    const board = this.turnResolver.board;
    const energyPos = board.getTrack(5).position; // Energy = track 5
    const sciencePos = board.getTrack(4).position; // Science = track 4
    if (energyPos <= sciencePos) {
      this.turnResolver.advanceTrackPublic(4); // Energy track = index 4
      this.game.log('MarsBot resolves Interface Hyperlink: advance energy track');
    } else {
      this.turnResolver.advanceTrackPublic(3); // Science track = index 3
      this.game.log('MarsBot resolves Interface Hyperlink: advance science track');
    }
  }

  private resolveGovernmentSubsidy(): void {
    // UNMI: gain 5 MC and advance any track (least-advanced)
    this.turnResolver.mcSupply += 5;
    const board = this.turnResolver.board;
    const leastIndex = board.getLeastAdvancedTrackIndex();
    this.turnResolver.advanceTrackPublic(leastIndex);
    this.game.log('MarsBot resolves Government Subsidy: +5 M€, advance least-advanced track');
  }

  private resolveInvestors(): void {
    // Utopia Invest: advance building (index 0) and space (index 1) tracks
    this.turnResolver.advanceTrackPublic(0);
    this.turnResolver.advanceTrackPublic(1);
    this.game.log('MarsBot resolves Investors: advance building + space tracks');
  }
}
