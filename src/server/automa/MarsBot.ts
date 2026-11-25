import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {Resource} from '../../common/Resource';
import {GlobalParameter} from '../../common/GlobalParameter';
import {CardName} from '../../common/cards/CardName';
import {newCard} from '../createCard';
import {DifficultyLevel, FAILED_ACTION_MC, FAILED_ACTION_MC_EASY, LAKEFRONT_OCEAN_BONUS, TrackDefinition, getAutomaMaxGeneration} from '../../common/automa/AutomaTypes';
import {marsBotMapRules} from '../../common/automa/MarsBotMapRules';
import {Tag} from '../../common/cards/Tag';
import {currentMcPerVP} from './MarsBotScoring';
import {MarsBotBoard} from './MarsBotBoard';
import {MarsBotModel} from '../../common/models/MarsBotModel';
import {BonusCardName} from '../../common/automa/BonusCardName';
import {createBonusCard} from './bonusCards/MarsBotBonusCards';
import {bonusCardNameFromSave} from './legacyBonusCards';
import {MarsBotBonusDeck} from './MarsBotBonusDeck';
import {MarsBotActionDeck} from './MarsBotActionDeck';
import {MarsBotTilePlacer} from './MarsBotTilePlacer';
import {MarsBotTurnResolver} from './MarsBotTurnResolver';
import {MarsBotScoring, MarsBotVPBreakdown} from './MarsBotScoring';
import {Space} from '../boards/Space';
import {Random} from '../../common/utils/Random';
import {IMarsBot} from './IMarsBot';
import {MarsBotCorp} from './MarsBotCorp';
import {trackCubeKey} from './corpTrackCubes';
import {MarsBotTrackCube} from './MarsBotCorpTypes';
import {MarsBotShippingBoard} from './colonies/MarsBotShippingBoard';
import {selectRandomColony, placeColony} from './colonies/MarsBotColonyPlacer';
import {MarsBotCorpResolver} from './corps/MarsBotCorpResolver';
import {getMarsBotCorp} from './corps/MarsBotCorpRegistry';
import {SerializedAutomaState} from '../SerializedGame';
import {SpaceId} from '../../common/Types';
import {inplaceRemove} from '../../common/utils/utils';
import {LogHelper} from '../LogHelper';
import {ColonyName} from '../../common/colonies/ColonyName';
import {TileType} from '../../common/TileType';
import {IAward} from '../awards/IAward';
import {maybeTrade} from './colonies/MarsBotTrader';
import {getClaimableMilestones, marsBotAwardScore, marsBotCanClaimMilestone, maybeClaimMilestone, maybeFundAward, selectMilestone} from './MarsBotMilestoneAwardEval';

/** Reads a saved action deck or bonus deck entry, which holds a bonus card in any form a save has held it, or a project card. */
function deckEntryFromSave(entry: string): BonusCardName | CardName {
  return bonusCardNameFromSave(entry) ?? entry as CardName;
}

/**
 * The automa manager, which owns MarsBot's board and decks and runs its turns.
 *
 * It is not a `Player` subclass. MarsBot uses a real `Player` instance for tile ownership and TR
 * tracking, and this manager drives that player from outside.
 */
export class MarsBot implements IMarsBot {
  public readonly marsBotBoard: MarsBotBoard;
  public readonly bonusDeck: MarsBotBonusDeck;
  public readonly turnResolver: MarsBotTurnResolver;
  private readonly tilePlacer: MarsBotTilePlacer;

  /** The current generation's action deck, and the bonus cards MarsBot draws into it. */
  public readonly actionDeck: MarsBotActionDeck;

  /** The space holding MarsBot's Neural Instance tile. Undefined until it places one. */
  public neuralInstanceSpace: Space | undefined;

  /** True when MarsBot goes first this generation. It alternates each generation, with the human first in generation 1. */
  public goesFirst: boolean = false;

  /**
   * Whether the corp's "before the action phase" box still waits for the player's preludes.
   * Generation 1 only: later generations resolve it as the action phase starts.
   */
  public beforeActionPhasePending: boolean = false;

  /** The last generation whose first-turn milestone check (Hard mode) has run. */
  public firstTurnCheckedGeneration: number = 0;

  /** Project cards MarsBot has resolved, which Hard mode scores. */
  public playedProjectCards: Array<IProjectCard> = [];

  /** MarsBot's corporation (rulebook B). Undefined until it selects one. */
  public corp: MarsBotCorp | undefined;

  public megacredits: number = 0;

  /** Cubes on MarsBot's tracks, from its corporation and the 2nd Trade Fleet, by key `trackIndex:position`. */
  public trackCubePositions: Map<string, MarsBotTrackCube> = new Map();

  /** Keys of the cubes that have triggered. A cube does not trigger again after its track regresses. */
  public triggeredCubePositions: Set<string> = new Set();

  /** VP total per generation (for end-game chart). */
  public vpByGeneration: Array<number> = [];

  /** Number of times MarsBot has raised the temperature (for the Thawer milestone). */
  public temperatureRaises: number = 0;

  /** True when colony cubes sit on MarsBot's tracks, with the modular Pioneer milestone or Constructor award in the game. */
  public hasColonyCubes: boolean = false;

  /** Keys of the colony cubes' positions, by `trackIndex:position`. */
  public colonyCubePositions: Set<string> = new Set();

  /** Corp-specific state (M€ on card, resources, cubes, etc.). */
  public corpSpecificState: Map<string, number> = new Map();

  /** Floater resources (Venus Next corps). */
  public floaters: number = 0;

  /**
   * Track-cube key of the 2nd Trade Fleet position (Colonies, rulebook C, p.4). Undefined without Colonies.
   *
   * Saved with the game, because a save can have the cube on the Event track.
   */
  public tradeFleetCubeKey: string | undefined = undefined;

  /** Whether MarsBot has unlocked the 2nd Trade Fleet (Colonies, rulebook C, p.6). */
  public hasSecondTradeFleet: boolean = false;

  /** Shipping Board with 11 storage areas, one per colony tile (rulebook C, p.5). */
  public shippingBoard: MarsBotShippingBoard = new MarsBotShippingBoard(this);

  /**
   * True while Government Intervention raises Venus: its global parameter bonuses and the colony the
   * raise earns pay MarsBot no M€. Only set during that synchronous raise, so never saved.
   */
  public bonusMcBlocked: boolean = false;

  /**
   * M€ that Government Intervention lets MarsBot keep while it resolves (Lakefront Resorts' advance).
   *
   * Undefined outside Government Intervention's no-M€ window, which is synchronous, so never saved.
   */
  public mcKeptThroughIntervention: number | undefined = undefined;

  /** Spaces holding one of MarsBot's player markers (Settlers) and no tile yet. */
  public markerSpaceIds: Array<SpaceId> = [];

  constructor(
    public readonly game: IGame,
    /** The Player instance that represents MarsBot in the game engine. */
    public readonly player: IPlayer,
    /** The human opponent. */
    public readonly humanPlayer: IPlayer,
    boardData: ReadonlyArray<TrackDefinition>,
    public readonly difficulty: DifficultyLevel,
    private readonly random: Random,
    /** True when a save is loaded: restoreState fills the bonus deck, so it starts empty. */
    restoring: boolean = false,
  ) {
    this.marsBotBoard = new MarsBotBoard(boardData);
    const opts = game.gameOptions;
    if (restoring) {
      this.bonusDeck = new MarsBotBonusDeck([], [], random);
    } else {
      this.bonusDeck = MarsBotBonusDeck.create(random, {
        venus: opts.expansions.venus,
        colonies: opts.expansions.colonies,
        boardName: opts.boardName,
        modularMA: opts.modularMA,
      });
    }
    // The 2nd Trade Fleet starts on space 9 of the Energy track (rulebook C, p.4), moved up by the map's shift
    if (opts.expansions.colonies) {
      const energyTrackIdx = this.marsBotBoard.tagToTrack[Tag.POWER];
      if (energyTrackIdx !== undefined) {
        this.tradeFleetCubeKey = trackCubeKey(energyTrackIdx, 9 + marsBotMapRules(opts.boardName).tradeFleetCubeShift);
      }
    }
    this.tilePlacer = new MarsBotTilePlacer(this);
    this.turnResolver = new MarsBotTurnResolver(this, this.tilePlacer);
    this.actionDeck = new MarsBotActionDeck(this, random);
  }

  // ---- Action Phase ----

  /** Takes one MarsBot action, on MarsBot's turn. */
  public takeTurn(): void {
    // Hard mode: the milestone check comes before the first turn of each generation resolves
    if (this.firstTurnCheckedGeneration !== this.game.generation) {
      this.firstTurnCheckedGeneration = this.game.generation;
      if (this.difficulty === 'hard' || this.difficulty === 'brutal') {
        this.hardModeFirstTurnMilestone();
      }
    }

    if (this.actionDeck.cards.length === 0) {
      this.game.playerHasPassed(this.player);
      this.game.log('MarsBot passed');
      this.game.playerIsFinishedTakingActions();
      return;
    }

    this.actionDeck.playTopCard();
    this.game.playerIsFinishedTakingActions();
  }

  /**
   * Claims a milestone on the first turn of a generation in Hard mode, for 8 M€.
   *
   * It claims only when it has the M€ and can fill all the milestone slots that are still open.
   */
  private hardModeFirstTurnMilestone(): void {
    if (this.megacredits < 8) {
      return;
    }
    if (this.game.allMilestonesClaimed()) {
      return;
    }

    const unclaimed = this.game.milestones.filter((m) => !this.game.milestoneClaimed(m));
    const claimedCount = this.game.claimedMilestones.length;
    const canClaimCount = unclaimed.filter((m) => marsBotCanClaimMilestone(m, this)).length;

    const shouldClaim = claimedCount < 3 && claimedCount + canClaimCount >= 3;

    if (shouldClaim) {
      const toClaim = selectMilestone(this, getClaimableMilestones(this));
      if (toClaim) {
        this.game.claimedMilestones.push({player: this.player, milestone: toClaim});
        this.megacredits -= 8;
        this.game.log('MarsBot claims milestone ${0} (Hard mode), loses 8 MC', (b) => b.rawString(toClaim.name));
      }
    }
  }

  /** Runs MarsBot's production phase. It does not produce, so only its per-generation state resets. */
  public runProductionPhase(): void {
    this.player.actionsThisGeneration.clear();
  }

  // ---- Final Greenery ----

  /**
   * Places final greenery tiles for MarsBot, one for each track with greenery as its next action.
   *
   * The tracker moves onto the greenery and the corp's cubes there trigger (IC, Teractor, Helion's
   * black cubes) unless `automaFinalGreeneryNoCorpEffects` is on (the designers leave it to the
   * players). Nothing chains from that space (BGG 3385156): the game has ended, so a
   * cube's own track advances and card draws do nothing (Thorgate keeps its temperature step,
   * Aridor's event track stays put). With no legal space the tracker stays and MarsBot takes a
   * Failed Action (rulebook A p.8, BGG 3404826).
   */
  public placeFinalGreeneries(): void {
    this.marsBotBoard.tracks.forEach((track, trackIndex) => {
      if (track.peek() !== 'greenery') {
        return;
      }
      const name = track.definition.tags[0];
      const space = this.tilePlacer.findGreenerySpace();
      if (space === undefined) {
        this.game.log('MarsBot: no space for a final greenery (${0} track)', (b) => b.rawString(name));
        this.turnResolver.failedAction();
        return;
      }
      // A final greenery raises neither the oxygen nor the TR.
      this.game.addGreenery(this.player, space, false);
      this.gainMc(this.tilePlacer.getTotalPlacementMC(space));
      track.advance();
      this.game.log('MarsBot places final greenery (${0} track)', (b) => b.rawString(name));
      if (!this.game.gameOptions.automaFinalGreeneryNoCorpEffects) {
        MarsBotCorpResolver.onTrackAdvanced(this, trackIndex, track.position, true);
      }
    });
  }

  // ---- Corporation ----

  /** Sets MarsBot's corporation and runs its setup. */
  public setCorpAndSetup(corp: MarsBotCorp): void {
    this.corp = corp;
    MarsBotCorpResolver.setupCorp(corp, this);
    this.game.log('MarsBot selects corporation: ${0}', (b) => b.rawString(corp.name));
  }

  // ---- IMarsBot: the view corp handlers get ----

  public corpVictoryPoints(): number {
    return this.corp?.vpBonus?.(this) ?? 0;
  }

  public get destroyedBonusCards(): number {
    return this.actionDeck.destroyedBonusCards;
  }

  public get actionDeckBonusCard(): BonusCardName | undefined {
    return this.corp?.actionDeckBonusCard;
  }

  /** C37: Septem Tribus uses Gray Eminence (B29) instead of Party Politics (B21). */
  public get replacesPartyPolitics(): boolean {
    return this.corp?.name === CardName.SEPTUM_TRIBUS;
  }

  public get failedActionMc(): number {
    return this.difficulty === 'easy' ? FAILED_ACTION_MC_EASY : FAILED_ACTION_MC;
  }

  public advanceTrack(trackIndex: number): void {
    this.turnResolver.advanceTrack(trackIndex);
  }

  public maybeAdvanceTrack(trackIndex: number): void {
    if (!this.marsBotBoard.tracks[trackIndex].canAdvance()) {
      this.game.log('MarsBot: track ${0} at max, no effect', (b) => b.number(trackIndex + 1));
      return;
    }
    this.advanceTrack(trackIndex);
  }

  public advanceTrackOfTag(tag: Tag): boolean {
    return this.turnResolver.advanceTrackOfTag(tag);
  }

  public onTagAdvance(tag: Tag): void {
    this.turnResolver.onTagAdvance(tag);
  }

  public resolveProjectCard(card: IProjectCard): void {
    this.playProjectCard(card, false);
  }

  /**
   * Puts `card` on MarsBot's played pile and resolves it, only its first tag with `firstTagOnly`.
   *
   * Every resolved project card goes to the played pile (rulebook A, p.5), not the project discard pile,
   * so it can't be drawn again.
   */
  private playProjectCard(card: IProjectCard, firstTagOnly: boolean): void {
    this.playedProjectCards.push(card);
    this.turnResolver.resolveProjectCard(card, firstTagOnly);
  }

  public removePlayedProjectCard(card: IProjectCard): void {
    inplaceRemove(this.playedProjectCards, card);
  }

  public loseMc(amount: number): number {
    const lost = Math.min(amount, this.megacredits);
    this.megacredits -= lost;
    return lost;
  }

  public maybeDrawAndResolveProjectCard(): void {
    if (this.gameHasEnded()) {
      return;
    }
    const cards = this.game.projectDeck.drawN(this.game, 1);
    if (cards.length === 0) {
      return;
    }
    this.playProjectCard(cards[0], false);
  }

  public maybeDrawAndResolveProjectCardFirstTagOnly(): void {
    if (this.gameHasEnded()) {
      return;
    }
    const cards = this.game.projectDeck.drawN(this.game, 1);
    if (cards.length === 0) {
      return;
    }
    this.playProjectCard(cards[0], true);
  }

  /**
   * Whether the game has ended, after which MarsBot draws and resolves no more cards, like its
   * tracks advance no more (MarsBotTurnResolver.advanceTrack). Logs it when so.
   */
  private gameHasEnded(): boolean {
    if (!this.game.isDoneWithFinalProduction()) {
      return false;
    }
    this.game.log('MarsBot: the game has ended, it draws no card');
    return true;
  }

  public maybeDrawAndResolveBonusCard(): void {
    if (this.gameHasEnded()) {
      return;
    }
    const bonusCard = this.bonusDeck.draw(this.game);
    if (bonusCard === undefined) {
      return;
    }
    this.actionDeck.playBonusCard(bonusCard);
  }

  public maybeClaimMilestone(): boolean {
    return maybeClaimMilestone(this);
  }

  public maybeFundAward(): boolean {
    return maybeFundAward(this);
  }

  /** MarsBot's score in `award`, with the easy difficulty handicap and its corp's bonus (Nirgal). */
  public awardValue(award: IAward): number {
    const offset = this.difficulty === 'easy' ? -5 : 0;
    const corpBonus = this.corp?.awardScoreBonus?.(this) ?? 0;
    return marsBotAwardScore(award, this) + offset + corpBonus;
  }

  public addProjectCardsToBonusDeck(tag: Tag, count: number): void {
    this.actionDeck.addProjectCardsToBonusDeck(tag, count);
  }

  public maybeMoveBonusCardToActionDeck(): void {
    this.actionDeck.maybeMoveBonusCardToActionDeck();
  }

  public returnSetupBonusCardToBonusDeck(): void {
    this.actionDeck.returnSetupBonusCardToBonusDeck();
  }

  /** Raises the temperature `steps` times. Pristar's cube cancels only the first, as the steps resolve one at a time (BGG 3431297, 3432237). */
  public raiseTemperature(steps: 1 | 2): void {
    // A corp effect is a reaction, not an action, so a maxed temperature is no Failed Action (Nick)
    if (this.game.getTemperature() >= this.game.max.temperature) {
      return;
    }
    const taken = this.interceptsParameterRaise(GlobalParameter.TEMPERATURE) ? steps - 1 : steps;
    if (taken === 0) {
      return;
    }
    const before = this.game.getTemperature();
    this.game.increaseTemperature(this.player, taken as 1 | 2);
    const raised = (this.game.getTemperature() - before) / 2;
    this.temperatureRaises += raised;
    this.game.log('MarsBot raises temperature ${0} step(s)', (b) => b.number(raised));
  }

  public advanceFurthestParameter(bonusCardName: BonusCardName, allowCorpIntercept: boolean = true): boolean {
    const game = this.game;
    const tempRemaining = (game.max.temperature - game.getTemperature()) / 2;
    const oxyRemaining = game.max.oxygen - game.getOxygenLevel();
    const oceanRemaining = game.max.oceans - game.board.getOceanSpaces().length;

    const params: Array<{message: string, remaining: number, action: () => boolean}> = [
      {message: 'MarsBot (${0}): raises the oxygen, furthest from completion', remaining: oxyRemaining, action: () => {
        if (game.getOxygenLevel() < game.max.oxygen) {
          if (allowCorpIntercept && this.interceptsParameterRaise(GlobalParameter.OXYGEN)) {
            return true;
          }
          game.increaseOxygenLevel(this.player, 1);
          return true;
        }
        return false;
      }},
      {message: 'MarsBot (${0}): places an ocean, furthest from completion', remaining: oceanRemaining, action: () => {
        if (game.canAddOcean()) {
          const tilePlacer = new MarsBotTilePlacer(this);
          const space = tilePlacer.findOceanSpace();
          if (space) {
            if (allowCorpIntercept && this.interceptsParameterRaise(GlobalParameter.OCEANS)) {
              return true;
            }
            game.addOcean(this.player, space);
            this.gainMc(tilePlacer.getTotalPlacementMC(space));
            return true;
          }
        }
        return false;
      }},
      {message: 'MarsBot (${0}): raises the temperature, furthest from completion', remaining: tempRemaining, action: () => {
        if (game.getTemperature() < game.max.temperature) {
          if (allowCorpIntercept && this.interceptsParameterRaise(GlobalParameter.TEMPERATURE)) {
            return true;
          }
          game.increaseTemperature(this.player, 1);
          return true;
        }
        return false;
      }},
    ];

    // Most steps remaining first, tie order preserved (oxygen, oceans, temperature)
    params.sort((a, b) => b.remaining - a.remaining);

    for (const p of params) {
      if (p.action()) {
        game.log(p.message, (b) => b.bonusCardName(bonusCardName));
        return true;
      }
    }
    return false;
  }

  public maybePlaceGreenery(filter?: (space: Space) => boolean): boolean {
    const game = this.game;
    const tilePlacer = new MarsBotTilePlacer(this);
    const space = tilePlacer.findGreenerySpace(filter);
    if (space === undefined) {
      return false;
    }
    const raiseOxygen = game.getOxygenLevel() >= game.max.oxygen ||
      !this.interceptsParameterRaise(GlobalParameter.OXYGEN);
    game.addGreenery(this.player, space, raiseOxygen);
    this.gainMc(tilePlacer.getTotalPlacementMC(space));
    return true;
  }

  public withoutTRGain(action: () => void): void {
    const trBefore = this.player.terraformRating;
    action();
    const trGained = this.player.terraformRating - trBefore;
    if (trGained > 0) {
      this.player.decreaseTerraformRating(trGained);
      this.game.log('MarsBot (${0}): returns ${1} TR', (b) => b.bonusCardName(BonusCardName.GOVERNMENT_INTERVENTION).number(trGained));
    }
  }

  public withoutMcGain(action: () => void): void {
    const mcBefore = this.megacredits;
    this.mcKeptThroughIntervention = 0;
    action();
    const kept = this.mcKeptThroughIntervention ?? 0;
    this.mcKeptThroughIntervention = undefined;
    const returned = this.megacredits - (mcBefore + kept);
    if (returned > 0) {
      this.megacredits = mcBefore + kept;
      this.game.log('MarsBot (${0}): returns ${1}:r:mc:', (b) => b.bonusCardName(BonusCardName.GOVERNMENT_INTERVENTION).number(returned));
    }
  }

  public withoutTRorMcGain(action: () => void): void {
    this.withoutMcGain(() => this.withoutTRGain(action));
  }

  public placeOcean(): void {
    this.turnResolver.placeOcean();
  }

  public placeCity(): void {
    this.turnResolver.placeCity();
  }

  public placeGreenery(): void {
    this.turnResolver.placeGreenery();
  }

  public drawProjectCardsToActionDeck(count: number): void {
    this.actionDeck.drawProjectCards(count);
  }

  public addBonusCardToActionDeck(bonusCardName: BonusCardName): void {
    const card = this.actionDeck.addBonusCard(bonusCardName);
    if (card === undefined) {
      return;
    }
    const corp = this.corp;
    if (corp !== undefined) {
      this.game.log('MarsBot (${0}): ${1} added to action deck', (b) => b.cardName(corp.name).bonusCardName(card.name));
    } else {
      this.game.log('MarsBot: ${0} added to action deck', (b) => b.bonusCardName(card.name));
    }
  }

  public removeBonusCard(bonusCardName: BonusCardName): void {
    this.actionDeck.removeBonusCard(bonusCardName);
  }

  public resolveBonusCard(bonusCardName: BonusCardName): void {
    const card = createBonusCard(bonusCardName);
    this.game.log('MarsBot resolves bonus card: ${0}', (b) => b.bonusCardName(card.name));
    card.resolve(this);
  }

  /** Puts one of MarsBot's player markers on `space`, which reserves the space for MarsBot. */
  public placeMarker(space: Space): void {
    space.player = this.player;
    this.markerSpaceIds.push(space.id);
    LogHelper.logBoardTileAction(this.player, space, 'player marker');
  }

  public removeMarker(space: Space): boolean {
    return inplaceRemove(this.markerSpaceIds, space.id);
  }

  public placeNeuralInstance(space: Space): void {
    this.game.simpleAddTile(this.player, space, {tileType: TileType.NEURAL_INSTANCE});
    this.gainMc(this.tilePlacer.getTotalPlacementMC(space));
    this.game.automaHooks?.handleTilePlaced(this.player, TileType.NEURAL_INSTANCE, space);
    this.neuralInstanceSpace = space;
  }

  public maybeTrade(bonusCardName: BonusCardName): void {
    maybeTrade(this, bonusCardName);
  }

  public addBonusCardToBonusDeck(bonusCardName: BonusCardName): void {
    this.actionDeck.addBonusCardToBonusDeck(bonusCardName);
  }

  public addBonusCardToBottomOfBonusDeck(bonusCardName: BonusCardName): void {
    this.actionDeck.addBonusCardToBottomOfBonusDeck(bonusCardName);
  }

  public getCorpState(key: string): number {
    return this.corpSpecificState.get(key) ?? 0;
  }

  public setCorpState(key: string, value: number): void {
    this.corpSpecificState.set(key, value);
  }

  public raiseTR(steps: number): void {
    if (steps > 0) {
      this.player.increaseTerraformRating(steps);
    } else if (steps < 0) {
      this.player.decreaseTerraformRating(-steps);
    }
  }

  public addFloaters(count: number): void {
    if (this.usesTitanStorageForFloaters()) {
      this.shippingBoard.add(ColonyName.TITAN, count);
    } else {
      this.floaters += count;
    }
  }

  public spendFloaters(count: number): void {
    if (this.usesTitanStorageForFloaters()) {
      this.shippingBoard.spend(ColonyName.TITAN, count);
    } else {
      this.floaters = Math.max(0, this.floaters - count);
    }
  }

  /** True when MarsBot keeps its floaters in the Titan storage area: Colonies without Venus Next (rulebook C, p.4-5). */
  private usesTitanStorageForFloaters(): boolean {
    const opts = this.game.gameOptions;
    return opts.expansions.colonies && !opts.expansions.venus;
  }

  /** Adds M€ to MarsBot's supply and tells the corp about it (Mining Guild). */
  public gainMc(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.megacredits += amount;
    this.corp?.onMcGained?.(this, amount);
  }

  /** Asks the corp to cancel a raise of `parameter` (Pristar). True means the raise is skipped. */
  public interceptsParameterRaise(parameter: GlobalParameter): boolean {
    return this.corp?.interceptGlobalParameterRaise?.(this, parameter) ?? false;
  }

  public notifyTagResolved(tag: Tag): void {
    this.corp?.onTagResolved?.(this, tag);
  }

  public notifyProjectCardResolved(card: IProjectCard): void {
    this.corp?.onProjectCardResolved?.(this, card);
  }

  public triggerTrackCube(trackIndex: number, position: number): boolean {
    return MarsBotCorpResolver.onTrackAdvanced(this, trackIndex, position);
  }

  public notifyTrackSpaceResolved(trackIndex: number, position: number): void {
    this.corp?.afterTrackSpaceResolved?.(this, trackIndex, position);
  }

  public notifyFailedAction(): void {
    this.corp?.onFailedAction?.(this);
  }

  public notifyColonyPlaced(): void {
    this.corp?.onColonyPlaced?.(this);
  }

  public maybePlaceRandomColony(): boolean {
    const colony = selectRandomColony(this);
    if (colony === undefined) {
      return false;
    }
    placeColony(colony, this);
    return true;
  }

  public canPlaceColony(): boolean {
    return this.player.colonies.getPlayableColonies().length > 0;
  }

  public maybeDiscardProjectCardWithFewestTags(): void {
    this.actionDeck.maybeDiscardProjectCardWithFewestTags();
  }

  /** Returns the cube on space `position` of the track `trackIndex`, if there is one. */
  public hasCubeAt(trackIndex: number, position: number): MarsBotTrackCube | undefined {
    return this.trackCubePositions.get(trackCubeKey(trackIndex, position));
  }

  /**
   * Keeps the 2nd Trade Fleet cube on the Event track for a save that doesn't record where it is.
   *
   * Those saves have it on space 9 of the Event track, so the game keeps using that cube to unlock
   * the 2nd Trade Fleet. Energy 9 can't settle it when the corporation is Helion, whose own white
   * cube sits there, so the Event track decides then.
   */
  private keepLegacyTradeFleetCube(hasSecondTradeFleet: boolean): void {
    const eventTrack = this.marsBotBoard.tagToTrack[Tag.EVENT];
    if (hasSecondTradeFleet || this.tradeFleetCubeKey === undefined || eventTrack === undefined) {
      return;
    }
    const legacyKey = trackCubeKey(eventTrack, 9);
    const energyCube = this.trackCubePositions.has(this.tradeFleetCubeKey) && this.corp?.name !== CardName.HELION;
    if (!energyCube && this.trackCubePositions.get(legacyKey)?.cubeType === 'white') {
      this.tradeFleetCubeKey = legacyKey;
    }
  }

  /** Whether the cube at this position has already triggered. */
  public isCubeTriggered(trackIndex: number, position: number): boolean {
    return this.triggeredCubePositions.has(trackCubeKey(trackIndex, position));
  }

  /** Marks the cube at this position as triggered. */
  public markCubeTriggered(trackIndex: number, position: number): void {
    this.triggeredCubePositions.add(trackCubeKey(trackIndex, position));
  }

  // ---- Scoring ----

  /** Calculates MarsBot's final VP. */
  public getVictoryPoints(): MarsBotVPBreakdown {
    return new MarsBotScoring(this).calculate();
  }

  /** Checks whether MarsBot instantly wins: at generation 20, 18 with Prelude, two more on Amazonis Planitia. Never without a generation limit. */
  public isInstantWin(): boolean {
    const opts = this.game.gameOptions;
    if (opts.automaNoGenerationLimit) {
      return false;
    }
    return this.game.generation >= getAutomaMaxGeneration(opts.expansions.prelude, opts.boardName);
  }

  // ---- Track Regression (human effects) ----

  /** Regresses the track of `productionType` when the human decreases MarsBot's production of it. */
  public regressTrack(productionType: Resource): void {
    for (let i = 0; i < this.marsBotBoard.tracks.length; i++) {
      const trackDef = this.marsBotBoard.definitions[i];
      if (trackDef.productions.includes(productionType)) {
        if (this.marsBotBoard.tracks[i].regress()) {
          this.game.log('MarsBot\'s ${0} track regressed (${1} production decreased)',
            (b) => b.rawString(trackDef.tags[0]).rawString(productionType));
        }
        return;
      }
    }
  }

  // ---- Client Model ----

  /** Builds the model sent to the client for display. */
  public toModel(): MarsBotModel {
    const vp = this.getVictoryPoints();
    const model: MarsBotModel = {
      name: this.player.name,
      color: this.player.color,
      difficulty: this.difficulty,
      tracks: this.marsBotBoard.tracks.map((track) => ({
        tags: track.definition.tags,
        productions: track.definition.productions,
        position: track.position,
        layout: track.definition.layout,
      })),
      terraformRating: this.player.terraformRating,
      megacredits: this.megacredits,
      actionDeckSize: this.actionDeck.cards.length,
      bonusDeckSize: this.bonusDeck.drawPile.length,
      vpBreakdown: vp,
      instantWin: this.isInstantWin(),
      globalParameterSteps: this.player.globalParameterSteps,
      vpByGeneration: this.vpByGeneration,
    };
    if (this.corp !== undefined) {
      model.corpName = this.corp.name as CardName;
      model.corpDescription = this.corp.description;
      // Cube track indexes match `model.tracks`, which the panel iterates from 0.
      model.trackCubes = Array.from(this.trackCubePositions.values()).map((c) => ({
        trackIndex: c.trackIndex, position: c.position, cubeType: c.cubeType,
      }));
    }
    const opts = this.game.gameOptions;
    const mcPerVP = currentMcPerVP(this.game);
    if (mcPerVP !== undefined) {
      model.mcPerVP = mcPerVP;
      model.mcVP = Math.floor(this.megacredits / mcPerVP);
    }
    if (opts.expansions.colonies && this.shippingBoard.storage.size > 0) {
      model.shippingBoard = this.shippingBoard.serialize();
    }
    return model;
  }

  // ---- Serialization ----

  public serialize(): SerializedAutomaState {
    const state: SerializedAutomaState = {
      trackPositions: this.marsBotBoard.tracks.map((t) => t.position),
      trackRegressedPositions: this.marsBotBoard.tracks.map((t) => Array.from(t.regressedPositions)),
      megacredits: this.megacredits,
      goesFirst: this.goesFirst,
      difficulty: this.difficulty,
      ...this.actionDeck.serialize(),
      bonusDeck: this.bonusDeck.serialize(),
      neuralInstanceSpaceId: this.neuralInstanceSpace?.id,
      playedProjectCardNames: this.playedProjectCards.map((c) => c.name),
      firstTurnCheckedGeneration: this.firstTurnCheckedGeneration,
      beforeActionPhasePending: this.beforeActionPhasePending,
      marsBotPlayerId: this.player.id,
      terraformRating: this.player.terraformRating,
      globalParameterSteps: {...this.player.globalParameterSteps},
    };
    if (this.corp !== undefined) {
      state.corpId = this.corp.name;
    }
    // Corp cubes and the trade fleet cube both go in the cube positions.
    if (this.trackCubePositions.size > 0) {
      state.trackCubePositions = Array.from(this.trackCubePositions.values());
    }
    if (this.triggeredCubePositions.size > 0) {
      state.triggeredCubePositions = Array.from(this.triggeredCubePositions);
    }
    if (this.hasSecondTradeFleet) {
      state.hasSecondTradeFleet = true;
    }
    if (this.tradeFleetCubeKey !== undefined) {
      state.tradeFleetCubeKey = this.tradeFleetCubeKey;
    }
    if (this.shippingBoard.storage.size > 0) {
      state.shippingBoard = this.shippingBoard.serialize();
    }
    if (this.corpSpecificState.size > 0) {
      state.corpSpecificState = Object.fromEntries(this.corpSpecificState);
    }
    if (this.floaters > 0) {
      state.floaters = this.floaters;
    }
    if (this.vpByGeneration.length > 0) {
      state.vpByGeneration = this.vpByGeneration;
    }
    if (this.temperatureRaises > 0) {
      state.temperatureRaises = this.temperatureRaises;
    }
    if (this.colonyCubePositions.size > 0) {
      state.colonyCubePositions = Array.from(this.colonyCubePositions);
    }
    if (this.markerSpaceIds.length > 0) {
      state.markerSpaceIds = [...this.markerSpaceIds];
    }
    return state;
  }

  public restoreState(state: SerializedAutomaState): void {
    for (let i = 0; i < state.trackPositions.length && i < this.marsBotBoard.tracks.length; i++) {
      const track = this.marsBotBoard.tracks[i];
      while (track.position < state.trackPositions[i]) {
        track.advance(); // Advances without resolving the space, since this restores state
      }
      track.regressedPositions = new Set(state.trackRegressedPositions[i] || []);
    }

    this.megacredits = state.megacredits ?? state.mcSupply ?? 0;

    // The bot player is rebuilt from scratch on load, so its scoring state lives here.
    if (state.terraformRating !== undefined) {
      this.player.setTerraformRating(state.terraformRating);
    }
    if (state.globalParameterSteps !== undefined) {
      Object.assign(this.player.globalParameterSteps, state.globalParameterSteps);
    }

    this.goesFirst = state.goesFirst;
    // Older saves lack it: assume the check for the current generation already ran
    this.firstTurnCheckedGeneration = state.firstTurnCheckedGeneration ?? this.game.generation;
    this.beforeActionPhasePending = state.beforeActionPhasePending ?? false;

    if (state.neuralInstanceSpaceId) {
      this.neuralInstanceSpace = this.game.board.spaces.find((s) => s.id === state.neuralInstanceSpaceId);
    }

    if (state.corpId !== undefined) {
      const corp = getMarsBotCorp(state.corpId as CardName);
      if (corp !== undefined) {
        this.corp = corp;
      }
    }
    // The bot player is rebuilt from scratch on load, so what a corporation's setup put on it comes back here
    if (this.corp?.name === CardName.LAKEFRONT_RESORTS) {
      this.player.oceanBonus = LAKEFRONT_OCEAN_BONUS;
    }
    if (state.trackCubePositions !== undefined) {
      this.trackCubePositions.clear();
      for (const cube of state.trackCubePositions) {
        this.trackCubePositions.set(trackCubeKey(cube.trackIndex, cube.position), cube);
      }
    }
    if (state.tradeFleetCubeKey !== undefined) {
      this.tradeFleetCubeKey = state.tradeFleetCubeKey;
    } else {
      this.keepLegacyTradeFleetCube(state.hasSecondTradeFleet === true);
    }
    if (state.triggeredCubePositions !== undefined) {
      this.triggeredCubePositions = new Set(state.triggeredCubePositions);
    }
    if (state.corpSpecificState !== undefined) {
      this.corpSpecificState = new Map(Object.entries(state.corpSpecificState).map(([k, v]) => [k, v as number]));
      // Older saves kept Ecoline's plant under its own key, where the player couldn't reach it
      const plantOnCard = this.corpSpecificState.get('plantOnCard');
      if (plantOnCard !== undefined) {
        this.corpSpecificState.delete('plantOnCard');
        this.corpSpecificState.set('plantResources', plantOnCard);
      }
    }
    const floaters = state.floaters ?? state.floaterCount;
    if (floaters !== undefined) {
      this.floaters = floaters;
    }
    if (state.vpByGeneration !== undefined) {
      this.vpByGeneration = [...state.vpByGeneration];
    }
    if (state.temperatureRaises !== undefined) {
      this.temperatureRaises = state.temperatureRaises;
    }
    if (state.hasSecondTradeFleet === true) {
      this.hasSecondTradeFleet = true;
    }
    if (state.shippingBoard !== undefined) {
      this.shippingBoard.restoreState(state.shippingBoard);
    }
    if (state.markerSpaceIds !== undefined) {
      this.markerSpaceIds = [...state.markerSpaceIds];
    }

    this.actionDeck.restore({...state, actionDeckCardNames: state.actionDeckCardNames?.map(deckEntryFromSave)});

    // Older saves hold the piles under their own keys
    const bonusDeck = MarsBotBonusDeck.deserialize({
      drawPile: (state.bonusDeck?.drawPile ?? state.bonusDeckDrawPile ?? []).map(deckEntryFromSave),
      discardPile: (state.bonusDeck?.discardPile ?? state.bonusDeckDiscardPile ?? []).map(deckEntryFromSave),
    }, this.random);
    // Older saves put cards that return to the action deck in the bonus deck's piles once they resolved
    this.bonusDeck.drawPile = bonusDeck.drawPile.filter((c) => !this.actionDeck.returnsToActionDeck(c));
    this.bonusDeck.discardPile = bonusDeck.discardPile.filter((c) => !this.actionDeck.returnsToActionDeck(c));

    if (state.playedProjectCardNames !== undefined) {
      this.playedProjectCards = [];
      for (const name of state.playedProjectCardNames) {
        const card = newCard(name as CardName);
        if (card !== undefined) {
          this.playedProjectCards.push(card as IProjectCard);
        }
      }
      // Older saves also left every resolved card in the project discard pile, where it could be
      // reshuffled and drawn again. A reshuffle may already have moved some into the draw pile.
      const played = new Set<string>(this.playedProjectCards.map((c) => c.name));
      for (const pile of [this.game.projectDeck.discardPile, this.game.projectDeck.drawPile]) {
        pile.splice(0, pile.length, ...pile.filter((c) => !played.has(c.name)));
      }
    }

    if (state.colonyCubePositions !== undefined) {
      this.colonyCubePositions = new Set(state.colonyCubePositions);
      this.hasColonyCubes = this.colonyCubePositions.size > 0;
    }
  }
}
