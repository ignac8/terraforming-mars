import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Color} from '../../common/Color';
import {PlayerId} from '../../common/Types';
import {MarsBot} from './MarsBot';
import {MarsBotModel} from '../../common/models/MarsBotModel';
import {getAutomaMaxGeneration} from '../../common/automa/AutomaTypes';
import {SelectCard} from '../inputs/SelectCard';
import {IProjectCard} from '../cards/IProjectCard';
import {toCorpCardRef} from './MarsBotCorpTypes';
import {inplaceRemove} from '../../common/utils/utils';
import {MarsBotCorpResolver} from './corps/MarsBotCorpResolver';
import {MarsBotDraftResolver} from './corps/MarsBotDraftResolver';
import {SerializedAutomaState} from '../SerializedGame';
import {IAward} from '../awards/IAward';
import {IMilestone} from '../milestones/IMilestone';
import {Tag} from '../../common/cards/Tag';
import {Resource} from '../../common/Resource';
import {SelectOption} from '../inputs/SelectOption';
import {IColony} from '../colonies/IColony';
import {ColonyName} from '../../common/colonies/ColonyName';

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
    return getAutomaMaxGeneration(opts.preludeExtension);
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

  /** Whether MarsBot has passed (used by Player.allOtherPlayersHavePassed). */
  public allOtherPlayersHavePassed(): boolean {
    return this.game.hasPassedThisActionPhase(this.marsBot.player);
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

    // Resolve roundStart per-gen effects
    const corp = this.marsBot.corp;
    if (corp?.perGeneration?.timing === 'roundStart') {
      MarsBotCorpResolver.resolvePerGenEffect(corp, this.marsBot);
    }

    if (this.game.gameOptions.draftVariant) {
      this.handleDraftResearchPhase();
      return true; // Draft handled — don't call runResearchPhase for human
    }
    this.marsBot.buildResearchActionDeck();
    this.handleFloaterExtraCard();
    return false;
  }

  /**
   * Check if MarsBot can spend floaters for an extra card.
   * Venus Next: requires Hoverlord to be unavailable and 5+ floaters.
   * C-X2/C-9: With Colonies but without Venus Next, use the same rule but
   *            Hoverlord is always considered unavailable (not in game).
   */
  private canSpendFloatersForExtraCard(): boolean {
    const opts = this.game.gameOptions;
    // C-9/C-X2: Colonies without Venus Next — floaters are in Titan storage
    // Hoverlord is always unavailable; check if Titan storage has 5+ floaters
    if (opts.coloniesExtension && !opts.venusNextExtension) {
      return this.marsBot.shippingBoard.get(ColonyName.TITAN) >= 5;
    }
    // Normal Venus Next rule
    if (!opts.venusNextExtension) return false;
    if (this.marsBot.floaterCount < 5) return false;
    // Hoverlord must be unavailable: not in game, already claimed, or all milestone slots full
    const hoverlordInGame = this.game.milestones.some((m) => m.name === 'Hoverlord');
    if (!hoverlordInGame) return true;
    if (this.game.allMilestonesClaimed()) return true;
    return this.game.claimedMilestones.some((cm) => cm.milestone.name === 'Hoverlord');
  }

  /** Venus Next (non-draft): spend 5 floaters for 1 extra card from project deck. */
  private handleFloaterExtraCard(): void {
    if (!this.canSpendFloatersForExtraCard()) return;

    const opts = this.game.gameOptions;
    if (opts.coloniesExtension && !opts.venusNextExtension) {
      // C-9/C-X2: Spend 5 from Titan storage (floaters) for extra card
      this.marsBot.shippingBoard.spend(ColonyName.TITAN, 5);
      const extraCards = this.game.projectDeck.drawN(this.game, 1);
      this.marsBot.actionDeck.push(...extraCards);
      this.game.log('MarsBot spends 5 Titan floaters for an extra card (C-9)');
    } else {
      this.marsBot.floaterCount -= 5;
      const extraCards = this.game.projectDeck.drawN(this.game, 1);
      this.marsBot.actionDeck.push(...extraCards);
      this.game.log('MarsBot spends 5 floaters for an extra card');
    }
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
    const draftPriority = this.marsBot.corp?.draftPriority;

    // Run all 4 draft rounds synchronously with human input chaining
    const runDraftRound = (round: number) => {
      if (round > 4) {
        // Draft complete — apply post-draft discard if corp has draft priority
        let finalMarsBotCards = marsBotKept;
        if (draftPriority !== undefined) {
          const result = MarsBotDraftResolver.postDraftDiscard(marsBotKept, draftPriority, this.game.rng);
          finalMarsBotCards = result.kept;
          for (const discarded of result.discarded) {
            this.game.projectDeck.discardPile.push(discarded);
          }
        }
        // Build MarsBot deck — Brutal keeps 4th card free; others spend 5 floaters to skip discard
        const isBrutal = this.marsBot.difficulty === 'brutal';
        const canSpend = this.canSpendFloatersForExtraCard();
        const skipDiscard = isBrutal || canSpend;
        if (!isBrutal && canSpend) {
          this.marsBot.floaterCount -= 5;
          this.game.log('MarsBot spends 5 floaters to keep 4th drafted card');
        }
        this.marsBot.buildResearchActionDeckFromDraft(finalMarsBotCards, skipDiscard);
        // Brutal: spend 5 floaters for a 5th card from project deck
        if (isBrutal && canSpend) {
          this.marsBot.floaterCount -= 5;
          const extra = this.game.projectDeck.drawN(this.game, 1);
          this.marsBot.actionDeck.push(...extra);
          this.game.log('MarsBot (Brutal) spends 5 floaters for a 5th card');
        }
        // Human gets their 4 drafted cards → buy phase
        humanPlayer.draftedCards = humanKept;
        humanPlayer.runResearchPhase();
        return;
      }

      // MarsBot picks 1 from its pile (priority-based if corp has draft priority, else random)
      if (marsBotPile.length > 0) {
        let picked: IProjectCard;
        if (draftPriority !== undefined) {
          picked = MarsBotDraftResolver.pickCardForMarsBot(
            marsBotPile, draftPriority, this.game.rng, this.marsBot.board,
          );
        } else {
          picked = marsBotPile[this.game.rng.nextInt(marsBotPile.length)];
        }
        inplaceRemove(marsBotPile, picked);
        marsBotKept.push(picked);
      }

      // Human picks 1 from their pile
      const selectCard = new SelectCard<IProjectCard>(
        `Draft round ${round}/4: Pick 1 card to keep`,
        'Keep',
        humanPile,
        {min: 1, max: 1},
      ).andThen((selected) => {
        humanKept.push(selected[0]);
        inplaceRemove(humanPile, selected[0]);

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

  /**
   * Called after the human picks their corporation in generation 1.
   * Selects and sets up MarsBot's corporation if the corp option is enabled.
   */
  public handlePostCorporationSetup(): void {
    if (!this.game.gameOptions.automaCorpOption) return;

    const humanCorpName = this.game.players[0]?.pickedCorporationCard?.name;
    if (humanCorpName === undefined) return;

    const corp = MarsBotCorpResolver.selectCorp(humanCorpName, this.game.rng);
    if (corp === undefined) {
      this.game.log('No MarsBot corporations available');
      return;
    }

    this.marsBot.setCorpAndSetup(corp);

    // If corp has beforeActionPhase per-gen effect, resolve it now (gen 1)
    if (corp.perGeneration?.timing === 'beforeActionPhase') {
      MarsBotCorpResolver.resolvePerGenEffect(corp, this.marsBot);
    }
  }

  /**
   * Called before the action phase each generation.
   * Resolves beforeActionPhase per-gen effects (gen 2+ only).
   */
  public handleBeforeActionPhase(): void {
    if (this.game.generation <= 1) return;
    const corp = this.marsBot.corp;
    if (corp === undefined) return;
    if (corp.perGeneration?.timing === 'beforeActionPhase') {
      MarsBotCorpResolver.resolvePerGenEffect(corp, this.marsBot);
    }
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

  public serialize(): SerializedAutomaState {
    return this.marsBot.serialize();
  }

  public restoreState(state: SerializedAutomaState): void {
    this.marsBot.restoreState(state);
  }

  // ---- Award/Milestone helpers (for base classes) ----

  /** Get MarsBot's player for inclusion in award/milestone comparisons. */
  public getMarsBotPlayer(): IPlayer {
    return this.marsBot.player;
  }

  /** Get MarsBot's score for a specific award (track-based). */
  public getMarsBotAwardScore(award: IAward): number {
    return this.marsBot.turnResolver.getMarsBotAwardValue(award);
  }

  /** Get MarsBot's score for a specific milestone. */
  public getMarsBotMilestoneScore(milestone: IMilestone): number {
    return milestone.getScore(this.marsBot.player);
  }

  /** Check if MarsBot can claim a specific milestone. */
  public canMarsBotClaimMilestone(milestone: IMilestone): boolean {
    return this.marsBot.turnResolver.marsBotMeetsMilestone(milestone);
  }

  /** Track MarsBot VP at end of each generation (for chart). */
  public updateVPForGeneration(): void {
    const vp = this.marsBot.getVictoryPoints();
    this.marsBot.vpByGeneration.push(vp.total);
  }

  // ---- Resource removal targeting ----

  /** Check if MarsBot MC supply is a valid target for card resource removal. */
  public hasRemoveResourceTarget(player: IPlayer, source: string): boolean {
    if (source === 'self') return false;
    const marsBot = this.marsBot.player;
    return marsBot !== player && marsBot.stock.megacredits > 0;
  }

  /** Get a SelectOption for targeting MarsBot MC supply, or undefined if not available. */
  public getRemoveResourceOption(player: IPlayer, count: number, source: string, cb: () => void): SelectOption | undefined {
    if (!this.hasRemoveResourceTarget(player, source)) return undefined;
    return new SelectOption(`Remove ${count} from MarsBot MC supply`)
      .andThen(() => {
        this.executeRemoveResource(player, count, cb);
        return undefined;
      });
  }

  /** Deduct from MarsBot MC supply as if card resources were removed. */
  public executeRemoveResource(player: IPlayer, count: number, cb: () => void): void {
    this.marsBot.player.stock.deduct(Resource.MEGACREDITS, count, {log: true, from: {player}});
    cb();
  }

  /** Build the model sent to the client. */
  public toModel(): MarsBotModel {
    return this.marsBot.toModel();
  }

  // ---- Corp effect hooks ----

  /** Called when the human player plays a project card. Notifies MarsBot's corp. */
  public handleHumanCardPlayed(card: IProjectCard): void {
    const corp = this.marsBot.corp;
    if (corp?.effect?.onHumanCardPlayed === undefined) return;
    corp.effect.onHumanCardPlayed(this.marsBot.getCorpContext(),
      toCorpCardRef(card.name, card.tags, card.cost, card.requirements !== undefined, card.getVictoryPoints(this.game.players[0])),
    );
  }

  /**
   * C-21: When the player trades with a colony where MarsBot has a colony,
   * intercept MarsBot's colony bonus and give 1 resource to shipping board instead
   * of the printed tile bonus.
   * C-24c: For Europa, give 1 MC to mcSupply instead.
   *
   * Returns true if MarsBot's colony bonus was handled (caller should skip normal flow).
   */
  public handleColonyBonus(colony: IColony, playerId: PlayerId): boolean {
    if (playerId !== this.marsBot.player.id) return false;
    // C-24c: Europa → 1 MC to mcSupply
    if (colony.name === ColonyName.EUROPA) {
      this.marsBot.turnResolver.mcSupply += 1;
      this.game.log('MarsBot gains 1 MC as Europa colony bonus (C-24c)');
      return true;
    }
    // C-21: Other colonies → 1 resource to shipping board
    this.marsBot.shippingBoard.add(colony.name, 1, this.marsBot);
    this.game.log('MarsBot gains 1 resource to ${0} storage (C-21)', (b) => b.colony(colony));
    return true;
  }

  /** Called when any player places a tile. Notifies MarsBot's corp. */
  public handleTilePlaced(player: IPlayer, tileType: number): void {
    const corp = this.marsBot.corp;
    if (corp?.effect?.onTilePlaced === undefined) return;
    corp.effect.onTilePlaced(this.marsBot.getCorpContext(), player === this.marsBot.player, tileType);
  }

  /** Called when Venus scale is raised. Notifies MarsBot's corp. */
  public handleVenusRaised(): void {
    const corp = this.marsBot.corp;
    if (corp?.effect?.onVenusRaised === undefined) return;
    corp.effect.onVenusRaised(this.marsBot.getCorpContext());
  }

  /** Called when a global parameter is raised. Returns true to SKIP the raise (Pristar). */
  public handleGlobalParameterRaised(parameter: string): boolean {
    const corp = this.marsBot.corp;
    if (corp?.effect?.onGlobalParameterRaised === undefined) return false;
    return corp.effect.onGlobalParameterRaised(this.marsBot.getCorpContext(), parameter) ?? false;
  }

  // ---- Card interaction hooks ----

  /** St. Joseph: MarsBot spends 2 MC and advances least-advanced track. Returns true if handled. */
  public handleStJosephCathedral(spaceOwner: IPlayer): boolean {
    if (spaceOwner !== this.marsBot.player) return false;
    if (this.marsBot.turnResolver.mcSupply >= 2) {
      this.marsBot.turnResolver.mcSupply -= 2;
      this.marsBot.turnResolver.advanceTrack(this.marsBot.board.getLeastAdvancedTrackIndex());
      this.game.log('MarsBot pays 2 MC and advances least-advanced track (St. Joseph)');
    } else {
      this.game.log('MarsBot cannot afford 2 MC for St. Joseph cathedral');
    }
    return true;
  }

  /** Sponsored Academies: MarsBot gains 1 MC instead of drawing. Returns true if handled. */
  public handleOpponentCardDraw(opponent: IPlayer): boolean {
    if (opponent !== this.marsBot.player) return false;
    this.marsBot.turnResolver.mcSupply += 1;
    this.game.log('MarsBot gains 1 MC (Sponsored Academies)');
    return true;
  }

  /** Galilean Waystation: behavior gives full MarsBot Jovian track, rulebook says half. Adjust after behavior runs. */
  public adjustGalileanWaystation(player: IPlayer): void {
    const jovianTrackIndex = this.marsBot.board.getTrackIndexForTag(Tag.JOVIAN);
    if (jovianTrackIndex === undefined) return;
    const fullPos = this.marsBot.board.tracks[jovianTrackIndex].position;
    const halfPos = Math.floor(fullPos / 2);
    const adjustment = halfPos - fullPos;
    if (adjustment !== 0) {
      player.production.add(Resource.MEGACREDITS, adjustment, {log: false});
    }
  }
}
