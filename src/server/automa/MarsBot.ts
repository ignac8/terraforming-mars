import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {DifficultyLevel, MARSBOT_MAX_TRACK_POSITION, MARSBOT_MAX_GENERATION} from '../../common/automa/AutomaTypes';
import {MarsBotBoard} from './MarsBotBoard';
import {MarsBotBoardData} from '../../common/automa/AutomaTypes';
import {MarsBotModel} from '../../common/automa/MarsBotModel';
import {MarsBotBonusCard} from './MarsBotBonusCard';
import {MarsBotBonusDeck} from './MarsBotBonusDeck';
import {MarsBotBonusResolver} from './MarsBotBonusResolver';
import {MarsBotTilePlacer} from './MarsBotTilePlacer';
import {MarsBotTurnResolver} from './MarsBotTurnResolver';
import {MarsBotScoring, MarsBotVPBreakdown} from './MarsBotScoring';
import {Space} from '../boards/Space';
import {Random} from '../../common/utils/Random';
import {inplaceShuffle} from '../utils/shuffle';

/**
 * MarsBot: the automa manager. Owns the board, decks, and coordinates turns.
 *
 * This is NOT a Player subclass — MarsBot uses a real Player instance for
 * game engine compatibility (tile ownership, TR tracking) but drives it
 * externally via this manager.
 */
export class MarsBot {
  public readonly board: MarsBotBoard;
  public readonly bonusDeck: MarsBotBonusDeck;
  public readonly turnResolver: MarsBotTurnResolver;
  private readonly bonusResolver: MarsBotBonusResolver;
  private readonly tilePlacer: MarsBotTilePlacer;

  /** The current generation's action deck (3 project cards + 1 bonus card). */
  public actionDeck: Array<IProjectCard | MarsBotBonusCard> = [];

  /** Space where the Neural Instance tile was placed (if any). */
  public neuralInstanceSpace: Space | undefined;

  /** Whether MarsBot goes first this generation (alternates each gen, human first in gen 1). */
  public goesFirst: boolean = false;

  /** Cards MarsBot has played (for Hard mode VP scoring). */
  public playedProjectCards: Array<IProjectCard> = [];

  constructor(
    public readonly game: IGame,
    /** The Player instance that represents MarsBot in the game engine. */
    public readonly player: IPlayer,
    /** The human opponent. */
    public readonly humanPlayer: IPlayer,
    boardData: MarsBotBoardData,
    public readonly difficulty: DifficultyLevel,
    private readonly random: Random,
  ) {
    this.board = new MarsBotBoard(boardData);
    this.bonusDeck = MarsBotBonusDeck.createBase(random);
    this.tilePlacer = new MarsBotTilePlacer(game, player, humanPlayer);
    this.turnResolver = new MarsBotTurnResolver(
      game, player, humanPlayer, this.board, difficulty, 0, this.tilePlacer,
    );
    this.bonusResolver = new MarsBotBonusResolver(
      game, player, humanPlayer, this.turnResolver, this.bonusDeck, this.tilePlacer,
    );
    this.bonusResolver.onNeuralInstancePlaced = (space) => {
      this.neuralInstanceSpace = space;
    };
  }

  // ---- Setup ----

  /** Build MarsBot's initial action deck: 3 project cards + 1 bonus card. */
  public buildInitialActionDeck(): void {
    const projectCards = this.game.projectDeck.drawN(this.game, 3);
    const bonusCard = this.bonusDeck.draw();
    const deck: Array<IProjectCard | MarsBotBonusCard> = [...projectCards];
    if (bonusCard) deck.push(bonusCard);
    inplaceShuffle(deck, this.random);
    this.actionDeck = deck;
  }

  // ---- Research Phase ----

  /** Build MarsBot's action deck for a new generation (non-drafting). */
  public buildResearchActionDeck(): void {
    const numProjectCards = this.difficulty === 'brutal' ? 4 : 3;
    const projectCards = this.game.projectDeck.drawN(this.game, numProjectCards);
    const bonusCard = this.bonusDeck.draw();

    const deck: Array<IProjectCard | MarsBotBonusCard> = [...projectCards];
    if (bonusCard !== undefined) {
      deck.push(bonusCard);
    }

    inplaceShuffle(deck, this.random);
    this.actionDeck = deck;

    this.game.log('MarsBot builds action deck with ${0} cards', (b) => b.number(this.actionDeck.length));
  }

  /** Build MarsBot's action deck from drafted cards (drafting variant). */
  public buildResearchActionDeckFromDraft(draftedCards: Array<IProjectCard>): void {
    // Shuffle drafted cards, discard 1 to project discard
    inplaceShuffle(draftedCards, this.random);
    const discarded = draftedCards.pop();
    if (discarded) {
      this.game.projectDeck.discardPile.push(discarded);
    }

    // Add 1 bonus card
    const bonusCard = this.bonusDeck.draw();
    const deck: Array<IProjectCard | MarsBotBonusCard> = [...draftedCards];
    if (bonusCard !== undefined) {
      deck.push(bonusCard);
    }

    inplaceShuffle(deck, this.random);
    this.actionDeck = deck;
    this.game.log('MarsBot builds action deck from draft with ${0} cards', (b) => b.number(this.actionDeck.length));
  }

  // ---- Action Phase ----

  /** Execute one MarsBot action (called when it's MarsBot's turn). */
  public takeTurn(): void {
    if (this.actionDeck.length === 0) {
      this.game.playerHasPassed(this.player);
      this.game.log('MarsBot passed');
      this.game.playerIsFinishedTakingActions();
      return;
    }

    const card = this.actionDeck.shift()!;

    if (this.isProjectCard(card)) {
      const projectCard = card as IProjectCard;
      this.playedProjectCards.push(projectCard);
      this.turnResolver.resolveProjectCard(projectCard);
    } else {
      const bonusCard = card as MarsBotBonusCard;
      this.game.log('MarsBot plays bonus card: ${0}', (b) => b.rawString(bonusCard.name));
      this.bonusResolver.resolve(bonusCard);
    }

    // Hard mode: first turn milestone check
    if (this.difficulty === 'hard' || this.difficulty === 'brutal') {
      this.hardModeFirstTurnMilestone();
    }

    // Signal that MarsBot's turn is done
    this.game.playerIsFinishedTakingActions();
  }

  /** Hard mode: on first turn of each gen, if 8 MC and meets milestone conditions, claim. */
  private hardModeFirstTurnMilestone(): void {
    if (this.player.actionsTakenThisRound !== 0) return; // Only first turn
    if (this.turnResolver.mcSupply < 8) return;

    const unclaimed = this.game.milestones.filter((m) => !this.game.milestoneClaimed(m));
    if (this.game.allMilestonesClaimed()) return;

    const claimedCount = this.game.claimedMilestones.length;
    const canClaimCount = unclaimed.filter((m) => m.canClaim(this.player)).length;

    let shouldClaim = false;
    if (claimedCount === 0 && canClaimCount >= 3) shouldClaim = true;
    if (claimedCount === 1 && canClaimCount >= 2) shouldClaim = true;
    if (claimedCount === 2 && canClaimCount >= 1) shouldClaim = true;

    if (shouldClaim) {
      const toClaim = unclaimed.find((m) => m.canClaim(this.player));
      if (toClaim) {
        this.game.claimedMilestones.push({player: this.player, milestone: toClaim});
        this.turnResolver.mcSupply -= 8;
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

  /** Place final greenery tiles for MarsBot (tracks with greenery as next action). */
  public placeFinalGreeneries(): void {
    for (const track of this.board.tracks) {
      const nextAction = track.peekNextAction();
      if (nextAction === 'greenery') {
        const space = this.tilePlacer.findGreenerySpace();
        if (space) {
          // Do NOT raise oxygen or award TR for final greenery
          this.game.addGreenery(this.player, space, false);
          track.advance(); // Move tracker forward
          this.game.log('MarsBot places final greenery (Track ${0})', (b) => b.number(track.definition.num));
        }
      }
    }
  }

  // ---- Scoring ----

  /** Calculate MarsBot's final VP. */
  public getVictoryPoints(): MarsBotVPBreakdown {
    const scoring = new MarsBotScoring(
      this.game, this.player, this.humanPlayer,
      this.turnResolver, this.difficulty, this.neuralInstanceSpace,
      this.playedProjectCards,
    );
    return scoring.calculate();
  }

  /** Check if MarsBot instantly wins (generation 20). */
  public isInstantWin(): boolean {
    return this.game.generation >= MARSBOT_MAX_GENERATION;
  }

  // ---- Track Regression (human effects) ----

  /** Regress a track when human decreases MarsBot's production. */
  public regressTrack(productionType: string): void {
    for (const trackDef of this.board.data.trackDefs) {
      if (trackDef.productions.includes(productionType)) {
        const track = this.board.getTrack(trackDef.num);
        track.regress();
        this.game.log('MarsBot\'s Track ${0} regressed (${1} production decreased)',
          (b) => b.number(trackDef.num).rawString(productionType));
        return;
      }
    }
  }

  // ---- Client Model ----

  /** Build the model sent to the client for display. */
  public toModel(): MarsBotModel {
    const isEnd = this.game.phase === 'end';
    const vp = isEnd ? this.getVictoryPoints() : undefined;
    return {
      difficulty: this.difficulty,
      tracks: this.board.tracks.map((track) => ({
        num: track.definition.num,
        tagNames: track.definition.tags.map((t) => t as string),
        position: track.position,
        maxPosition: MARSBOT_MAX_TRACK_POSITION,
      })),
      mcSupply: this.turnResolver.mcSupply,
      actionDeckSize: this.actionDeck.length,
      bonusDeckSize: this.bonusDeck.drawPile.length,
      vpBreakdown: vp,
      instantWin: this.isInstantWin(),
    };
  }

  // ---- Serialization ----

  public serialize(): import('../SerializedGame').SerializedAutomaState {
    return {
      trackPositions: this.board.tracks.map((t) => t.position),
      trackRegressedPositions: this.board.tracks.map((t) => Array.from(t.regressedPositions)),
      mcSupply: this.turnResolver.mcSupply,
      goesFirst: this.goesFirst,
      difficulty: this.difficulty,
      actionDeckCardNames: this.actionDeck.map((c) => this.isProjectCard(c) ? c.name : (c as MarsBotBonusCard).id),
      bonusDeckDrawPile: this.bonusDeck.drawPile.map((c) => c.id),
      bonusDeckDiscardPile: this.bonusDeck.discardPile.map((c) => c.id),
      destroyedBonusCards: this.bonusDeck.drawPile.concat(this.bonusDeck.discardPile)
        .filter((c) => c.destroyed).map((c) => c.id),
      neuralInstanceSpaceId: this.neuralInstanceSpace?.id,
      playedProjectCardNames: this.playedProjectCards.map((c) => c.name),
      marsBotPlayerId: this.player.id,
    };
  }

  public restoreState(state: import('../SerializedGame').SerializedAutomaState): void {
    // Restore track positions
    for (let i = 0; i < state.trackPositions.length && i < this.board.tracks.length; i++) {
      const track = this.board.tracks[i];
      // Set position directly
      while (track.position < state.trackPositions[i]) {
        track.advance(); // We advance without resolving actions since we're restoring state
      }
      track.regressedPositions = new Set(state.trackRegressedPositions[i] || []);
    }

    // Restore MC
    this.turnResolver.mcSupply = state.mcSupply;

    // Restore first player
    this.goesFirst = state.goesFirst;

    // Restore neural instance
    if (state.neuralInstanceSpaceId) {
      this.neuralInstanceSpace = this.game.board.spaces.find((s) => s.id === state.neuralInstanceSpaceId);
    }
  }

  // ---- Utilities ----

  private isProjectCard(card: IProjectCard | MarsBotBonusCard): card is IProjectCard {
    return 'cost' in card && 'tags' in card;
  }
}
