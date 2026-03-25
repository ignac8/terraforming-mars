import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Color} from '../../common/Color';
import {PlayerId} from '../../common/Types';
import {MarsBot} from './MarsBot';
import {MarsBotModel} from '../../common/automa/MarsBotModel';
import {getAutomaMaxGeneration} from '../../common/automa/AutomaTypes';
import {SelectCard} from '../inputs/SelectCard';
import {IProjectCard} from '../cards/IProjectCard';

/**
 * All automa (MarsBot) hooks into the Game lifecycle.
 *
 * Game.ts holds this as `automaHooks?: AutomaGameHooks`.
 * Each method returns a boolean or value indicating whether the hook handled the call.
 * When `automaHooks` is undefined, the `?.` operator returns undefined/false and
 * the game proceeds with normal behavior.
 */
export class AutomaGameHooks {
  constructor(
    private readonly game: IGame,
    public readonly marsBot: MarsBot,
  ) {}

  /** Check if a player is the MarsBot player. */
  public isAutomaPlayer(player: IPlayer): boolean {
    return player === this.marsBot.player;
  }

  // ---- Solo mode overrides ----

  /** Automa games are NOT solo mode (they behave as 2-player). */
  public isSoloMode(): boolean {
    return false;
  }

  /** Automa: game goes up to generation 20 (or 18 with Prelude). */
  public lastSoloGeneration(): number {
    return this.getMaxGeneration();
  }

  /** Get the max generation for this automa game. */
  public getMaxGeneration(): number {
    const opts = this.game.gameOptions;
    return getAutomaMaxGeneration(opts.preludeExtension, opts.prelude2Expansion);
  }

  /** Automa: game ends when Mars is terraformed or max generation reached. */
  public isGameOver(): boolean {
    if (this.game.generation >= this.getMaxGeneration()) return true;
    return this.game.marsIsTerraformed();
  }

  // ---- Turn flow ----

  /**
   * Handle MarsBot's turn when it's the active player.
   * Returns true if handled (MarsBot took its turn), false if this is the human player.
   */
  public handleStartActions(player: IPlayer): boolean {
    if (player === this.marsBot.player) {
      this.marsBot.takeTurn();
      return true;
    }
    return false;
  }

  /**
   * Get the next player for turn alternation.
   * Returns the player who should go next, or undefined if both have passed
   * (meaning Game should proceed to production).
   */
  public getNextPlayer(): IPlayer | undefined {
    const humanPlayer = this.game.players[0];
    const marsBotPlayer = this.marsBot.player;
    const humanPassed = this.game.hasPassedThisActionPhase(humanPlayer);
    const marsBotPassed = this.game.hasPassedThisActionPhase(marsBotPlayer);

    if (humanPassed && marsBotPassed) return undefined;

    // Alternate: if human just went, MarsBot goes next (and vice versa)
    if (this.game.activePlayer === humanPlayer && !marsBotPassed) return marsBotPlayer;
    if (this.game.activePlayer === marsBotPlayer && !humanPassed) return humanPlayer;

    // One has passed, give turn to the other
    if (!humanPassed) return humanPlayer;
    if (!marsBotPassed) return marsBotPlayer;

    return undefined;
  }

  /** Check if all players (including MarsBot) have passed. */
  public allPlayersHavePassed(): boolean | undefined {
    if (!this.game.hasPassedThisActionPhase(this.marsBot.player)) {
      return false;
    }
    return undefined; // Let normal logic continue checking human players
  }

  /** Get the first player for the action phase (handles alternation). */
  public getFirstPlayerForActionPhase(): IPlayer | undefined {
    if (this.marsBot.goesFirst) {
      return this.marsBot.player;
    }
    return undefined; // Use normal first player
  }

  // ---- Phase hooks ----

  /**
   * Handle MarsBot's research phase.
   * Returns true if the draft variant was handled (caller should NOT call runResearchPhase).
   */
  public handleResearchPhase(): boolean {
    if (this.game.generation > 1) {
      this.marsBot.goesFirst = !this.marsBot.goesFirst;
    }
    if (this.game.gameOptions.draftVariant) {
      this.handleDraftResearchPhase();
      return true; // Draft handled — don't call runResearchPhase for human
    }
    this.marsBot.buildResearchActionDeck();
    return false;
  }

  /**
   * Automa draft rules (page 4):
   * 1. Draw two piles of 4 cards
   * 2. Human takes one pile, MarsBot gets the other
   * 3. Pick 1 card from your pile to keep. MarsBot gets 1 random from its pile.
   * 4. Swap piles. Repeat until both have 4 cards.
   * 5. Shuffle MarsBot's 4, discard 1, add 1 bonus card → action deck (4 cards)
   * 6. Human chooses which of their 4 to keep and pay for.
   */
  private handleDraftResearchPhase(): void {
    const humanPlayer = this.game.players[0];
    const pileA = this.game.projectDeck.drawN(this.game, 4);
    const pileB = this.game.projectDeck.drawN(this.game, 4);

    let humanPile = [...pileA];
    let marsBotPile = [...pileB];
    const humanKept: Array<IProjectCard> = [];
    const marsBotKept: Array<IProjectCard> = [];

    // Run all 4 draft rounds synchronously with human input chaining
    const runDraftRound = (round: number) => {
      if (round > 4) {
        // Draft complete — build MarsBot deck
        this.marsBot.buildResearchActionDeckFromDraft(marsBotKept);
        // Human gets their 4 drafted cards → buy phase
        humanPlayer.draftedCards = humanKept;
        humanPlayer.runResearchPhase();
        return;
      }

      // MarsBot picks 1 random from its pile
      if (marsBotPile.length > 0) {
        const randomIndex = Math.floor(this.game.rng.next() * marsBotPile.length);
        marsBotKept.push(marsBotPile.splice(randomIndex, 1)[0]);
      }

      // Human picks 1 from their pile
      const selectCard = new SelectCard<IProjectCard>(
        `Draft round ${round}/4: Pick 1 card to keep`,
        'Keep',
        humanPile,
        {min: 1, max: 1},
      ).andThen((selected) => {
        humanKept.push(selected[0]);
        const idx = humanPile.indexOf(selected[0]);
        if (idx >= 0) humanPile.splice(idx, 1);

        // Swap piles
        const temp = humanPile;
        humanPile = marsBotPile;
        marsBotPile = temp;

        // Next round
        runDraftRound(round + 1);
        return undefined;
      });

      humanPlayer.setWaitingFor(selectCard, () => {});
    };

    runDraftRound(1);
  }

  /** Returns true if this player's production should be skipped (MarsBot). */
  public handleProductionPhase(player: IPlayer): boolean {
    if (player === this.marsBot.player) {
      this.marsBot.runProductionPhase();
      return true;
    }
    return false;
  }

  /** Place MarsBot's final greenery tiles. */
  public handleFinalGreenery(donePlayers: Set<PlayerId>): void {
    if (!donePlayers.has(this.marsBot.player.id)) {
      this.marsBot.placeFinalGreeneries();
      donePlayers.add(this.marsBot.player.id);
    }
  }

  // ---- Bonus interception ----

  /** Returns false if placement bonuses should be skipped for this player. */
  public shouldGrantPlacementBonuses(player: IPlayer): boolean {
    return player !== this.marsBot.player;
  }

  /**
   * Handle temperature heat bonus for MarsBot (2 MC instead of heat production).
   * Returns true if handled.
   */
  public handleTemperatureHeatBonus(player: IPlayer): boolean {
    if (player === this.marsBot.player) {
      this.marsBot.turnResolver.mcSupply += 2;
      this.game.log('MarsBot gains 2 MC (temperature heat bonus)');
      return true;
    }
    return false;
  }

  // ---- Utility ----

  /** Resolve the color for a passed player ID that might be MarsBot. */
  public getPassedPlayerColor(playerId: PlayerId): Color | undefined {
    if (this.marsBot.player.id === playerId) {
      return this.marsBot.player.color;
    }
    return undefined;
  }

  // ---- Serialization ----

  public serialize(): import('../SerializedGame').SerializedAutomaState {
    return this.marsBot.serialize();
  }

  public restoreState(state: import('../SerializedGame').SerializedAutomaState): void {
    this.marsBot.restoreState(state);
  }

  // ---- Award/Milestone helpers (for base classes) ----

  /** Get MarsBot's player for inclusion in award/milestone comparisons. */
  public getMarsBotPlayer(): IPlayer {
    return this.marsBot.player;
  }

  /** Get MarsBot's score for a specific award (track-based). */
  public getMarsBotAwardScore(award: import('../awards/IAward').IAward): number {
    return this.marsBot.turnResolver.getMarsBotAwardValue(award);
  }

  /** Get MarsBot's score for a specific milestone. */
  public getMarsBotMilestoneScore(milestone: import('../milestones/IMilestone').IMilestone): number {
    return milestone.getScore(this.marsBot.player);
  }

  /** Check if MarsBot can claim a specific milestone. */
  public canMarsBotClaimMilestone(milestone: import('../milestones/IMilestone').IMilestone): boolean {
    return this.marsBot.turnResolver.marsBotMeetsMilestone(milestone);
  }

  /** Build the model sent to the client. */
  public toModel(): MarsBotModel {
    return this.marsBot.toModel();
  }
}
