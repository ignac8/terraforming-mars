import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {Resource} from '../../common/Resource';
import {GlobalParameter} from '../../common/GlobalParameter';
import {CardName} from '../../common/cards/CardName';
import {newCard} from '../createCard';
import {DifficultyLevel, BonusCardId, TrackDefinition, getAutomaMaxGeneration} from '../../common/automa/AutomaTypes';
import {Tag} from '../../common/cards/Tag';
import {currentMcPerVP} from './MarsBotScoring';
import {MarsBotBoard} from './MarsBotBoard';
import {marsBotCardTags} from './MarsBotTags';
import {MarsBotModel} from '../../common/models/MarsBotModel';
import {MarsBotBonusCard, MarsBotBonusDeckCard, bonusCardDisplayName, createCorpBonusCard} from './MarsBotBonusCard';
import {MarsBotBonusDeck} from './MarsBotBonusDeck';
import {MarsBotBonusResolver} from './MarsBotBonusResolver';
import {MarsBotTilePlacer} from './MarsBotTilePlacer';
import {MarsBotTurnResolver} from './MarsBotTurnResolver';
import {MarsBotScoring, MarsBotVPBreakdown} from './MarsBotScoring';
import {Space} from '../boards/Space';
import {Random} from '../../common/utils/Random';
import {inplaceShuffle} from '../utils/shuffle';
import {IMarsBot, IMarsBotCorp, MarsBotTrackCube, trackCubeKey} from './MarsBotCorpTypes';
import {MarsBotShippingBoard} from './colonies/MarsBotShippingBoard';
import {selectRandomColony, placeColonyForMarsBot} from './colonies/MarsBotColonyPlacer';
import {MarsBotCorpResolver} from './corps/MarsBotCorpResolver';
import {getMarsBotCorp} from './corps/MarsBotCorpRegistry';
import {SerializedAutomaState} from '../SerializedGame';
import {SpaceId} from '../../common/Types';
import {inplaceRemove} from '../../common/utils/utils';
import {LogHelper} from '../LogHelper';
import {ColonyName} from '../../common/colonies/ColonyName';

/** Expansion bonus cards set aside at setup: each generation they go back into the action deck. */
const SET_ASIDE_BONUS_CARDS: ReadonlySet<BonusCardId> = new Set([
  BonusCardId.B16_GOVERNMENT_INTERVENTION,
  BonusCardId.B19_SHIPPING_LINES,
  BonusCardId.B20_EXTENDED_SHIPPING_LINES,
  BonusCardId.B21_PARTY_POLITICS,
]);

/**
 * MarsBot: the automa manager. Owns the board, decks, and coordinates turns.
 *
 * This is NOT a Player subclass — MarsBot uses a real Player instance for
 * game engine compatibility (tile ownership, TR tracking) but drives it
 * externally via this manager.
 */
export class MarsBot implements IMarsBot {
  public readonly marsBotBoard: MarsBotBoard;
  public readonly bonusDeck: MarsBotBonusDeck;
  public readonly turnResolver: MarsBotTurnResolver;
  private readonly bonusResolver: MarsBotBonusResolver;
  private readonly tilePlacer: MarsBotTilePlacer;

  /** The current generation's action deck (project cards + optional bonus card). */
  public actionDeck: Array<IProjectCard | MarsBotBonusCard> = [];

  /** Space where the Neural Instance tile was placed (if any). */
  public neuralInstanceSpace: Space | undefined;

  /** Whether MarsBot goes first this generation (alternates each gen, human first in gen 1). */
  public goesFirst: boolean = false;

  /**
   * Whether the corp's "before the action phase" box still waits for the player's preludes.
   * Generation 1 only: later generations resolve it as the action phase starts.
   */
  public beforeActionPhasePending: boolean = false;

  /** The last generation whose first-turn milestone check (Hard mode) has run. */
  public firstTurnCheckedGeneration: number = 0;

  /** Cards MarsBot has played (for Hard mode VP scoring). */
  public playedProjectCards: Array<IProjectCard> = [];

  /** Corporation card (Rulebook B). */
  public corp: IMarsBotCorp | undefined;

  /** Track cube positions placed by the corporation. Key: "trackIndex:position". */
  public trackCubePositions: Map<string, MarsBotTrackCube> = new Map();

  /** Cube positions that have already been triggered (won't re-trigger after regression). */
  public triggeredCubePositions: Set<string> = new Set();

  /** VP total per generation (for end-game chart). */
  public vpByGeneration: Array<number> = [];

  /** Number of times MarsBot raised temperature (for Thawer milestone). */
  public temperatureRaises: number = 0;

  /** Number of bonus cards destroyed while resolving (for the Land Specialist milestone). */
  public destroyedBonusCards: number = 0;

  /** Whether colony cubes are placed (Pioneer4/Constructor in game). */
  public hasColonyCubes: boolean = false;

  /** Colony cube positions (set by AutomaGameSetup when Pioneer4/Constructor in game). */
  public colonyCubePositions: Set<string> = new Set();

  /** Corp-specific state (M€ on card, resources, cubes, etc.). */
  public corpSpecificState: Map<string, number> = new Map();

  /** Floater resources (Venus Next corps). */
  public floaters: number = 0;

  /**
   * Track-cube key for the 2nd Trade Fleet position (Colonies, C-6).
   * Set in constructor when coloniesExtension is enabled; undefined otherwise. Saved with the
   * game, because games from before the cube moved to the Energy track keep it on the Event track.
   */
  public tradeFleetCubeKey: string | undefined = undefined;

  /** Whether MarsBot has unlocked the 2nd Trade Fleet (Colonies, C-27). */
  public hasSecondTradeFleet: boolean = false;

  /** Shipping Board with 11 storage areas, one per colony tile (C-18). */
  public shippingBoard: MarsBotShippingBoard = new MarsBotShippingBoard();

  /**
   * True while Government Intervention raises Venus: its global parameter bonuses pay MarsBot no
   * MC. Only set during that synchronous raise, so never saved.
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
  ) {
    this.marsBotBoard = new MarsBotBoard(boardData);
    const opts = game.gameOptions;
    if (opts.coloniesExtension && opts.venusNextExtension) {
      this.bonusDeck = MarsBotBonusDeck.createWithVenusAndColonies(random);
    } else if (opts.coloniesExtension) {
      this.bonusDeck = MarsBotBonusDeck.createWithColonies(random);
    } else if (opts.venusNextExtension) {
      this.bonusDeck = MarsBotBonusDeck.createWithVenus(random);
    } else {
      this.bonusDeck = MarsBotBonusDeck.createBase(random);
    }
    // C-6: the 2nd Trade Fleet starts on space 9 of the Energy track, on every map
    if (opts.coloniesExtension) {
      const energyTrackIdx = this.marsBotBoard.tagToTrack[Tag.POWER];
      if (energyTrackIdx !== undefined) {
        this.tradeFleetCubeKey = trackCubeKey(energyTrackIdx, 9);
      }
    }
    this.tilePlacer = new MarsBotTilePlacer(game, player, humanPlayer);
    this.turnResolver = new MarsBotTurnResolver(
      game, player, humanPlayer, this.marsBotBoard, difficulty, 0, this.tilePlacer,
    );
    this.bonusResolver = new MarsBotBonusResolver(
      game, player, humanPlayer, this.turnResolver, this.bonusDeck, this.tilePlacer,
    );
    this.bonusResolver.onNeuralInstancePlaced = (space) => {
      this.neuralInstanceSpace = space;
    };
    this.bonusResolver.marsBotManager = this;
  }

  // ---- Setup ----

  /** Build MarsBot's initial action deck: 3 project cards (4 on Brutal) + 1 bonus card (+ 3 extra with Prelude). */
  public buildInitialActionDeck(): void {
    const opts = this.game.gameOptions;
    // Prelude: MarsBot gets 3 extra project cards instead of Prelude cards
    const numProjectCards = (this.difficulty === 'brutal' ? 4 : 3) + (opts.preludeExtension ? 3 : 0);
    const projectCards = this.game.projectDeck.drawN(this.game, numProjectCards);
    const bonusCard = this.bonusDeck.draw(this.game);
    const deck: Array<IProjectCard | MarsBotBonusCard> = [...projectCards];
    if (bonusCard) {
      deck.push(bonusCard);
    }
    this.addGovernmentIntervention(deck);
    // T-3: Shuffle Party Politics into the initial action deck when Turmoil is enabled
    this.addPartyPolitics(deck);
    inplaceShuffle(deck, this.random);
    this.actionDeck = deck;
  }

  /** Add Government Intervention (B16) to action deck if Venus is enabled. */
  private addGovernmentIntervention(deck: Array<IProjectCard | MarsBotBonusCard>): void {
    if (this.game.gameOptions.venusNextExtension) {
      deck.push(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));
    }
  }

  /** T-3/T-6: Add Party Politics (B21) to the deck if Turmoil is enabled.
   * C37: Septem Tribus replaces Party Politics with Gray Eminence — skip B21 when active. */
  private addPartyPolitics(deck: Array<IProjectCard | MarsBotBonusCard>): void {
    if (!this.game.gameOptions.turmoilExtension) {
      return;
    }
    // C37: Septem Tribus uses Gray Eminence (B29) instead of Party Politics (B21)
    if (this.corp?.name === CardName.SEPTUM_TRIBUS) {
      return;
    }
    deck.push(createCorpBonusCard(BonusCardId.B21_PARTY_POLITICS));
  }

  /**
   * C-10: After gen 1, shuffle Shipping Lines (B19) into the action deck.
   * C-11: If 2nd Trade Fleet is unlocked, also shuffle Extended Shipping Lines (B20).
   */
  private addShippingLines(deck: Array<IProjectCard | MarsBotBonusCard>): void {
    if (!this.game.gameOptions.coloniesExtension) {
      return;
    }
    if (this.game.generation <= 1) {
      return;
    }
    deck.push(createCorpBonusCard(BonusCardId.B19_SHIPPING_LINES));
    if (this.hasSecondTradeFleet) {
      deck.push(createCorpBonusCard(BonusCardId.B20_EXTENDED_SHIPPING_LINES));
    }
  }

  // ---- Research Phase ----

  /** Build MarsBot's action deck for a new generation (non-drafting). */
  public buildResearchActionDeck(): void {
    const numProjectCards = this.difficulty === 'brutal' ? 4 : 3;
    const projectCards = this.game.projectDeck.drawN(this.game, numProjectCards);
    const bonusCard = this.bonusDeck.draw(this.game);

    const deck: Array<IProjectCard | MarsBotBonusCard> = [...projectCards];
    if (bonusCard !== undefined) {
      deck.push(bonusCard);
    }
    this.addGovernmentIntervention(deck);
    // T-6: Reshuffle Party Politics into action deck each generation
    this.addPartyPolitics(deck);
    // C-10/C-11: Inject Shipping Lines (and Extended if 2nd Trade Fleet unlocked)
    this.addShippingLines(deck);

    inplaceShuffle(deck, this.random);
    this.actionDeck = deck;

    this.game.log('MarsBot builds action deck with ${0} cards', (b) => b.number(this.actionDeck.length));
  }

  /** Build MarsBot's action deck from drafted cards (drafting variant). */
  public buildResearchActionDeckFromDraft(draftedCards: Array<IProjectCard>, skipDiscard: boolean = false): void {
    inplaceShuffle(draftedCards, this.random);
    if (!skipDiscard) {
      // Normally discard 1 drafted card to project discard
      const discarded = draftedCards.pop();
      if (discarded) {
        this.game.projectDeck.discardPile.push(discarded);
      }
    }

    // Add 1 bonus card
    const bonusCard = this.bonusDeck.draw(this.game);
    const deck: Array<IProjectCard | MarsBotBonusCard> = [...draftedCards];
    if (bonusCard !== undefined) {
      deck.push(bonusCard);
    }
    this.addGovernmentIntervention(deck);
    // T-6: Reshuffle Party Politics into action deck each generation
    this.addPartyPolitics(deck);
    // C-10/C-11: Inject Shipping Lines (and Extended if 2nd Trade Fleet unlocked)
    this.addShippingLines(deck);

    inplaceShuffle(deck, this.random);
    this.actionDeck = deck;
    this.game.log('MarsBot builds action deck from draft with ${0} cards', (b) => b.number(this.actionDeck.length));
  }

  // ---- Action Phase ----

  /** Execute one MarsBot action (called when it's MarsBot's turn). */
  public takeTurn(): void {
    // Hard mode: the milestone check comes before the first turn of each generation resolves
    if (this.firstTurnCheckedGeneration !== this.game.generation) {
      this.firstTurnCheckedGeneration = this.game.generation;
      if (this.difficulty === 'hard' || this.difficulty === 'brutal') {
        this.hardModeFirstTurnMilestone();
      }
    }

    if (this.actionDeck.length === 0) {
      this.game.playerHasPassed(this.player);
      this.game.log('MarsBot passed');
      this.game.playerIsFinishedTakingActions();
      return;
    }

    const card = this.actionDeck.shift();
    if (card === undefined) {
      return;
    }

    if (this.isProjectCard(card)) {
      this.turnResolver.resolveProjectCard(card as IProjectCard);
    } else {
      const bonusCard = card as MarsBotBonusCard;
      this.game.log('MarsBot plays bonus card: ${0}', (b) => b.rawString(bonusCardDisplayName(bonusCard)));
      this.bonusResolver.resolve(bonusCard);
    }

    // Signal that MarsBot's turn is done
    this.game.playerIsFinishedTakingActions();
  }

  /** Hard mode: on first turn of each gen, if 8 MC and meets milestone conditions, claim.
   * MarsBot starts at 0 MC and accumulates from failed actions (5 MC each) and placement bonuses. */
  private hardModeFirstTurnMilestone(): void {
    if (this.turnResolver.megacredits < 8) {
      return;
    }
    if (this.game.allMilestonesClaimed()) {
      return;
    }

    const unclaimed = this.game.milestones.filter((m) => !this.game.milestoneClaimed(m));
    const claimedCount = this.game.claimedMilestones.length;
    const canClaimCount = unclaimed.filter((m) => this.turnResolver.marsBotMeetsMilestone(m)).length;

    // MarsBot claims when it can fill all 3 milestone slots (needs 3 - claimedCount eligible).
    const shouldClaim = claimedCount < 3 && claimedCount + canClaimCount >= 3;

    if (shouldClaim) {
      const toClaim = this.turnResolver.selectMilestone(this.turnResolver.getClaimableMilestones());
      if (toClaim) {
        this.game.claimedMilestones.push({player: this.player, milestone: toClaim});
        this.turnResolver.megacredits -= 8;
        this.game.log('MarsBot claims milestone ${0} (Hard mode), loses 8 MC', (b) => b.rawString(toClaim.name));
      }
    }
  }

  /** Production phase: MarsBot skips production entirely. */
  public runProductionPhase(): void {
    // MarsBot does not produce. Just reset per-generation state.
    this.player.actionsThisGeneration.clear();
  }

  // ---- Final Greenery ----

  /**
   * Place final greenery tiles for MarsBot (tracks with greenery as next action).
   *
   * The tracker moves onto the greenery and the corp's cubes there trigger (IC, Teractor, Helion's
   * black cubes), but nothing chains from that space (BGG 3385156). With no legal space the
   * tracker stays and MarsBot takes a Failed Action (rulebook A p.8, BGG 3404826).
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
      // Do NOT raise oxygen or award TR for final greenery
      this.game.addGreenery(this.player, space, false);
      this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(space));
      track.advance();
      this.game.log('MarsBot places final greenery (${0} track)', (b) => b.rawString(name));
      MarsBotCorpResolver.onTrackAdvanced(this, trackIndex, track.position, true);
    });
  }

  // ---- Corporation ----

  /** Set the corporation and run its setup. */
  public setCorpAndSetup(corp: IMarsBotCorp): void {
    this.corp = corp;
    MarsBotCorpResolver.setupCorp(corp, this);
    this.game.log('MarsBot selects corporation: ${0}', (b) => b.rawString(corp.name));
  }

  // ---- IMarsBot: the view corp handlers get ----

  public get megacredits(): number {
    return this.turnResolver.megacredits;
  }

  public set megacredits(mc: number) {
    this.turnResolver.megacredits = mc;
  }

  public advanceTrack(trackIndex: number): void {
    this.turnResolver.advanceTrack(trackIndex);
  }

  public maybeDrawAndResolveProjectCard(): void {
    const cards = this.game.projectDeck.drawN(this.game, 1);
    if (cards.length === 0) {
      return;
    }
    this.turnResolver.resolveProjectCard(cards[0]);
  }

  public maybeDrawAndResolveProjectCardFirstTagOnly(): void {
    const cards = this.game.projectDeck.drawN(this.game, 1);
    if (cards.length === 0) {
      return;
    }
    this.turnResolver.resolveProjectCard(cards[0], true);
  }

  public maybeDrawAndResolveBonusCard(): void {
    const bonusCard = this.bonusDeck.draw(this.game);
    if (bonusCard === undefined) {
      return;
    }
    this.bonusResolver.resolve(bonusCard);
  }

  public maybeClaimMilestone(): boolean {
    return this.turnResolver.maybeClaimMilestone();
  }

  public maybeFundAward(): boolean {
    return this.turnResolver.maybeFundAward();
  }

  public addProjectCardsToBonusDeck(tag: Tag, count: number): void {
    const cards = this.game.projectDeck.drawByConditionOrThrow(this.game, count, (card) => marsBotCardTags(card).includes(tag));
    for (const card of cards) {
      this.shuffleIntoBonusDeck(card);
      this.game.log('MarsBot adds ${0} to its bonus deck', (b) => b.card(card));
    }
  }

  public maybeMoveBonusCardToActionDeck(): void {
    const bonusCard = this.bonusDeck.draw(this.game);
    if (bonusCard === undefined) {
      return;
    }
    this.shuffleIntoActionDeck(bonusCard);
  }

  public returnSetupBonusCardToBonusDeck(): void {
    const kept: Array<IProjectCard | MarsBotBonusCard> = [];
    for (const card of this.actionDeck) {
      if (this.isProjectCard(card) || this.returnsToActionDeck(card)) {
        kept.push(card);
      } else {
        this.shuffleIntoBonusDeck(card);
        this.game.log('MarsBot returns ${0} to its bonus deck', (b) => b.rawString(bonusCardDisplayName(card)));
      }
    }
    this.actionDeck = kept;
  }

  public raiseTemperature(steps: 1 | 2): void {
    this.turnResolver.raiseTemperature(steps);
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
    const cards = this.game.projectDeck.drawN(this.game, count);
    for (const card of cards) {
      this.shuffleIntoActionDeck(card);
    }
  }

  public addBonusCardToActionDeck(bonusCardId: BonusCardId): void {
    if (this.actionDeck.some((c) => !this.isProjectCard(c) && c.id === bonusCardId)) {
      return;
    }
    // Take the card out of the bonus deck when it is there, otherwise create it
    const card = this.bonusDeck.findAndRemove(bonusCardId) ?? createCorpBonusCard(bonusCardId);
    this.shuffleIntoActionDeck(card);
  }

  /** Puts a card into the action deck at a random position. */
  private shuffleIntoActionDeck(card: IProjectCard | MarsBotBonusCard): void {
    this.actionDeck.splice(this.random.nextInt(this.actionDeck.length + 1), 0, card);
  }

  /** Whether a bonus card goes back into the action deck every generation, so it never belongs in the bonus deck. */
  public returnsToActionDeck(card: MarsBotBonusDeckCard): boolean {
    if (card.id === undefined) {
      return false;
    }
    return SET_ASIDE_BONUS_CARDS.has(card.id) || card.id === this.corp?.actionDeckBonusCard;
  }

  public removeBonusCard(bonusCardId: BonusCardId): void {
    this.bonusDeck.removeById(bonusCardId);
    // The setup bonus card is dealt before the corporation is chosen (rulebook A setup step 3).
    // When the corp destroys that card, the bonus deck deals a replacement, so the first action
    // deck keeps its bonus card. A set-aside expansion card (Party Politics) gets none.
    const dealt = this.actionDeck.find((c) => !this.isProjectCard(c) && c.id === bonusCardId) as MarsBotBonusCard | undefined;
    if (dealt === undefined) {
      return;
    }
    inplaceRemove(this.actionDeck, dealt);
    if (!this.returnsToActionDeck(dealt)) {
      this.maybeMoveBonusCardToActionDeck();
      this.game.log('MarsBot replaces the destroyed setup bonus card with one from its bonus deck');
    }
  }

  public resolveBonusCard(bonusCardId: BonusCardId): void {
    const card = createCorpBonusCard(bonusCardId);
    this.game.log('MarsBot resolves bonus card: ${0}', (b) => b.rawString(bonusCardDisplayName(card)));
    this.bonusResolver.resolveEffect(card);
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

  public addBonusCardToBonusDeck(bonusCardId: BonusCardId): void {
    this.shuffleIntoBonusDeck(createCorpBonusCard(bonusCardId));
  }

  /** Puts a card into the bonus deck's draw pile at a random position. */
  private shuffleIntoBonusDeck(card: MarsBotBonusDeckCard): void {
    const drawPile = this.bonusDeck.drawPile;
    drawPile.splice(this.random.nextInt(drawPile.length + 1), 0, card);
  }

  public addBonusCardToBottomOfBonusDeck(bonusCardId: BonusCardId): void {
    // The deck draws from the end of the draw pile
    this.bonusDeck.drawPile.unshift(createCorpBonusCard(bonusCardId));
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
      this.shippingBoard.add(ColonyName.TITAN, count, this);
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

  /** True when MarsBot keeps its floaters in the Titan storage area: Colonies without Venus Next (C-14, C-23). */
  private usesTitanStorageForFloaters(): boolean {
    const opts = this.game.gameOptions;
    return opts.coloniesExtension && !opts.venusNextExtension;
  }

  public gainMc(amount: number): void {
    this.turnResolver.gainMc(amount);
  }

  /** Ask the corp to intercept a parameter raise (Pristar). True means the raise is skipped. */
  public interceptsParameterRaise(parameter: GlobalParameter): boolean {
    return this.corp?.effect?.interceptGlobalParameterRaise?.(this, parameter) ?? false;
  }

  public maybePlaceRandomColony(): boolean {
    const colony = selectRandomColony(this.game, this);
    if (colony === undefined) {
      return false;
    }
    placeColonyForMarsBot(colony, this);
    return true;
  }

  public maybeDiscardProjectCardWithFewestTags(): void {
    let fewest: IProjectCard | undefined;
    for (const card of this.actionDeck) {
      if (this.isProjectCard(card) && (fewest === undefined || marsBotCardTags(card).length < marsBotCardTags(fewest).length)) {
        fewest = card;
      }
    }
    if (fewest === undefined) {
      return;
    }
    const discarded = fewest;
    inplaceRemove(this.actionDeck, discarded);
    this.game.projectDeck.discardPile.push(discarded);
    this.game.log('MarsBot (Polyphemos): discarded ${0}, the project card with the fewest tags, from its action deck', (b) => b.card(discarded));
  }

  /** Check if a cube exists at a given track position. */
  public hasCubeAt(trackIndex: number, position: number): MarsBotTrackCube | undefined {
    return this.trackCubePositions.get(trackCubeKey(trackIndex, position));
  }

  /**
   * Games saved before the Trade Fleet cube moved to the Energy track have it on space 9 of the
   * Event track, and don't record where it is. Keep using that cube so those games still unlock
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

  /** Check if a cube at this position has already been triggered. */
  public isCubeTriggered(trackIndex: number, position: number): boolean {
    return this.triggeredCubePositions.has(trackCubeKey(trackIndex, position));
  }

  /** Mark a cube position as triggered. */
  public markCubeTriggered(trackIndex: number, position: number): void {
    this.triggeredCubePositions.add(trackCubeKey(trackIndex, position));
  }

  // ---- Scoring ----

  /** Calculate MarsBot's final VP. */
  public getVictoryPoints(): MarsBotVPBreakdown {
    const corpVpBonus = this.corp?.effect?.vpBonus?.(this) ?? 0;
    const scoring = new MarsBotScoring(
      this.game, this.player, this.humanPlayer,
      this.turnResolver, this.difficulty, this.neuralInstanceSpace,
      this.playedProjectCards, corpVpBonus,
    );
    return scoring.calculate();
  }

  /** Check if MarsBot instantly wins (gen 20, or gen 18 with Prelude). Never without a generation limit. */
  public isInstantWin(): boolean {
    const opts = this.game.gameOptions;
    if (opts.automaNoGenerationLimit) {
      return false;
    }
    return this.game.generation >= getAutomaMaxGeneration(opts.preludeExtension);
  }

  // ---- Track Regression (human effects) ----

  /** Regress a track when human decreases MarsBot's production. */
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

  /** Build the model sent to the client for display. */
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
      megacredits: this.turnResolver.megacredits,
      actionDeckSize: this.actionDeck.length,
      bonusDeckSize: this.bonusDeck.drawPile.length,
      vpBreakdown: vp,
      instantWin: this.isInstantWin(),
      globalParameterSteps: this.player.globalParameterSteps,
      vpByGeneration: this.vpByGeneration,
    };
    if (this.corp !== undefined) {
      model.corpName = this.corp.name as CardName;
      model.corpDescription = this.corp.description;
      // Cube track indexes match model.tracks, which the panel iterates from 0.
      model.trackCubes = Array.from(this.trackCubePositions.values()).map((c) => ({
        trackIndex: c.trackIndex, position: c.position, cubeType: c.cubeType,
      }));
    }
    const opts = this.game.gameOptions;
    const mcPerVP = currentMcPerVP(this.game);
    if (mcPerVP !== undefined) {
      model.mcPerVP = mcPerVP;
      model.mcVP = Math.floor(this.turnResolver.megacredits / mcPerVP);
    }
    // C-18: Shipping Board storage (Colonies)
    if (opts.coloniesExtension && this.shippingBoard.storage.size > 0) {
      model.shippingBoard = this.shippingBoard.serialize();
    }
    return model;
  }

  // ---- Serialization ----

  public serialize(): SerializedAutomaState {
    const state: SerializedAutomaState = {
      trackPositions: this.marsBotBoard.tracks.map((t) => t.position),
      trackRegressedPositions: this.marsBotBoard.tracks.map((t) => Array.from(t.regressedPositions)),
      megacredits: this.turnResolver.megacredits,
      goesFirst: this.goesFirst,
      difficulty: this.difficulty,
      actionDeckCardNames: this.actionDeck.map((c) => this.isProjectCard(c) ? c.name : (c as MarsBotBonusCard).id),
      bonusDeckDrawPile: this.bonusDeck.drawPile.map((c) => c.id ?? c.name),
      bonusDeckDiscardPile: this.bonusDeck.discardPile.map((c) => c.id ?? c.name),
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
    // Serialize cube positions whenever they exist (corp cubes AND trade fleet cube, C-6)
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
    if (this.destroyedBonusCards > 0) {
      state.destroyedBonusCards = this.destroyedBonusCards;
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
    // Restore track positions
    for (let i = 0; i < state.trackPositions.length && i < this.marsBotBoard.tracks.length; i++) {
      const track = this.marsBotBoard.tracks[i];
      // Set position directly
      while (track.position < state.trackPositions[i]) {
        track.advance(); // We advance without resolving actions since we're restoring state
      }
      track.regressedPositions = new Set(state.trackRegressedPositions[i] || []);
    }

    // Restore MC
    this.turnResolver.megacredits = state.megacredits ?? state.mcSupply ?? 0;

    // The bot player is rebuilt from scratch on load, so its scoring state lives here.
    if (state.terraformRating !== undefined) {
      this.player.setTerraformRating(state.terraformRating);
    }
    if (state.globalParameterSteps !== undefined) {
      Object.assign(this.player.globalParameterSteps, state.globalParameterSteps);
    }

    // Restore first player
    this.goesFirst = state.goesFirst;
    // Older saves lack it: assume the check for the current generation already ran
    this.firstTurnCheckedGeneration = state.firstTurnCheckedGeneration ?? this.game.generation;
    this.beforeActionPhasePending = state.beforeActionPhasePending ?? false;

    // Restore neural instance
    if (state.neuralInstanceSpaceId) {
      this.neuralInstanceSpace = this.game.board.spaces.find((s) => s.id === state.neuralInstanceSpaceId);
    }

    // Restore corporation state
    if (state.corpId !== undefined) {
      const corp = getMarsBotCorp(state.corpId as CardName);
      if (corp !== undefined) {
        this.corp = corp;
      }
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
    if (state.destroyedBonusCards !== undefined) {
      this.destroyedBonusCards = state.destroyedBonusCards;
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

    // Restore action deck (project cards + bonus cards)
    if (state.actionDeckCardNames !== undefined) {
      this.actionDeck = this.deserializeDeckCards(state.actionDeckCardNames);
    }

    // Restore bonus deck (bonus cards + project cards a corporation put there)
    if (state.bonusDeckDrawPile !== undefined) {
      this.bonusDeck.drawPile = this.deserializeDeckCards(state.bonusDeckDrawPile);
    }
    if (state.bonusDeckDiscardPile !== undefined) {
      this.bonusDeck.discardPile = this.deserializeDeckCards(state.bonusDeckDiscardPile);
    }
    // Older saves discarded these to the bonus deck after they resolved
    this.bonusDeck.drawPile = this.bonusDeck.drawPile.filter((c) => !this.returnsToActionDeck(c));
    this.bonusDeck.discardPile = this.bonusDeck.discardPile.filter((c) => !this.returnsToActionDeck(c));

    // Restore played project cards
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

    // Restore colony cube positions
    if (state.colonyCubePositions !== undefined) {
      this.colonyCubePositions = new Set(state.colonyCubePositions);
      this.hasColonyCubes = this.colonyCubePositions.size > 0;
    }
  }

  // ---- Utilities ----

  /** Rebuilds serialized deck cards: bonus cards are stored by id, project cards by name. */
  private deserializeDeckCards(names: ReadonlyArray<string>): Array<IProjectCard | MarsBotBonusCard> {
    const cards: Array<IProjectCard | MarsBotBonusCard> = [];
    for (const name of names) {
      if (Object.values(BonusCardId).includes(name as BonusCardId)) {
        cards.push(createCorpBonusCard(name as BonusCardId));
      } else {
        const card = newCard(name as CardName);
        if (card !== undefined) {
          cards.push(card as IProjectCard);
        }
      }
    }
    return cards;
  }

  /** Type guard to distinguish project cards from bonus cards in the action deck. */
  private isProjectCard(card: IProjectCard | MarsBotBonusCard): card is IProjectCard {
    return 'cost' in card && 'tags' in card;
  }
}
