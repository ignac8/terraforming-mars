import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {ICard} from '../cards/ICard';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {GlobalParameter} from '../../common/GlobalParameter';
import {ColonyName} from '../../common/colonies/ColonyName';
import {
  TrackAction,
  FAILED_ACTION_MC,
  FAILED_ACTION_MC_EASY,
  DifficultyLevel,
} from '../../common/automa/AutomaTypes';
import {MarsBotBoard} from './MarsBotBoard';
import {cardTagsIncludingEvent} from './MarsBotTags';
import {MarsBotTilePlacer} from './MarsBotTilePlacer';
import {placeColonyForMarsBot, selectRandomColony} from './colonies/MarsBotColonyPlacer';
import type {MarsBot} from './MarsBot';

/**
 * Resolves MarsBot turns: flips cards from the action deck, advances tracks,
 * and performs track actions.
 */
export class MarsBotTurnResolver {
  public readonly tilePlacer: MarsBotTilePlacer;

  /** Reference to the MarsBot manager (set after construction for corp cube triggers). */
  public marsBotManager: MarsBot | undefined;

  constructor(
    private readonly game: IGame,
    private readonly botPlayer: IPlayer,
    private readonly humanPlayer: IPlayer,
    public readonly marsBotBoard: MarsBotBoard,
    private readonly difficulty: DifficultyLevel,
    public megacredits: number = 0,
    tilePlacer: MarsBotTilePlacer,
  ) {
    this.tilePlacer = tilePlacer;
  }

  // ---- Project Card Resolution ----

  /** Resolve a project card: advance tracks based on tags. With `firstTagOnly` the other tags are ignored (Thorgate). */
  public resolveProjectCard(original: IProjectCard, firstTagOnly: boolean = false): void {
    this.game.log('MarsBot plays ${0}', (b) => b.card(original));

    const allTags = cardTagsIncludingEvent(original);
    const tags = firstTagOnly ? allTags.slice(0, 1) : allTags;
    // Effects below see only the resolved tags. Object.create keeps the prototype (methods like
    // getVictoryPoints).
    const card = firstTagOnly ? Object.create(original, {tags: {value: tags}}) as IProjectCard : original;

    // A card with no tags is still played: its corp and player effects apply below.
    if (tags.length === 0) {
      this.game.log('MarsBot takes a Failed Action (card has no tags)');
      this.failedAction();
    }

    // Resolve each tag left-to-right
    let advancedAny = false;
    for (const tag of tags) {
      this.marsBotManager?.notifyTagResolved(tag);
      if (tag === Tag.WILD) {
        // Prelude rule: advance the least-advanced track, topmost if tied
        const leastIndex = this.marsBotBoard.getLeastAdvancedTrackIndex();
        this.game.log('MarsBot: wild tag advances least-advanced track ${0}', (b) => b.number(leastIndex + 1));
        this.advanceTrack(leastIndex);
        advancedAny = true;
        continue;
      }

      const trackIndex = this.marsBotBoard.tagToTrack[tag];
      if (trackIndex === undefined) {
        this.game.log('MarsBot: tag ${0} has no matching track, ignored', (b) => b.rawString(tag));
        continue;
      }

      this.advanceTrack(trackIndex);
      advancedAny = true;
    }
    if (!advancedAny && tags.length > 0) {
      this.game.log('MarsBot: no tracks advanced');
    }

    // Notify corp of card resolution
    this.marsBotManager?.notifyProjectCardResolved(card);

    // Notify human player's effect cards (Solar Logistics, Saturn Systems, etc.)
    this.notifyPlayerCards(card);
  }

  /**
   * Runs the player's "when any player plays a card" effects for a card MarsBot resolved.
   *
   * MarsBot keeps no resources on its cards, so the effects see the card without a resource
   * type. Otherwise Splice asks MarsBot to pick between M€ and a microbe on the card, and
   * nobody answers for MarsBot.
   */
  public notifyPlayerCards(card: ICard, onlyCards?: ReadonlyArray<CardName>): void {
    const played: ICard = Object.create(card, {resourceType: {value: undefined}});
    for (const effectCard of this.humanPlayer.playedCards) {
      if (onlyCards !== undefined && !onlyCards.includes(effectCard.name)) {
        continue;
      }
      this.humanPlayer.defer(effectCard.onCardPlayedByAnyPlayer?.(this.humanPlayer, played, this.botPlayer));
    }
  }

  // ---- Track Advancement ----

  private trackName(trackIndex: number): string {
    return this.marsBotBoard.tracks[trackIndex]?.definition.tags[0] ?? `Track ${trackIndex}`;
  }

  /**
   * Advance a track by index. Handles chain actions.
   *
   * Returns false when the track was already at its end, which is a Failed Action instead.
   *
   * Once the game has ended no track advances and nothing fails: only the final greenery moves a
   * tracker, which MarsBot.placeFinalGreeneries does without this.
   */
  public advanceTrack(trackIndex: number): boolean {
    const track = this.marsBotBoard.tracks[trackIndex];
    const name = this.trackName(trackIndex);
    if (this.game.isDoneWithFinalProduction()) {
      this.game.log('MarsBot: the game has ended, ${0} track does not advance', (b) => b.rawString(name));
      return false;
    }
    // Moving back up after a regression retriggers nothing (rulebook B, p.3)
    const reAdvance = track.regressedPositions.has(track.position + 1);

    const result = track.advance();

    if (result.type === 'maxed') {
      this.game.log('MarsBot: ${0} track at max, Failed Action', (b) => b.rawString(name));
      this.failedAction();
      return false;
    }

    // A cube's effect can move this track on again, so the log keeps the space reached here.
    const position = track.position;

    // Cube trigger — fires BEFORE track icon resolution (corp cubes, colony cubes, trade fleet cube)
    if (this.marsBotManager?.triggerTrackCube(trackIndex, position)) {
      this.game.log('MarsBot: ${0} track to ${1}, icon replaced by a corp cube',
        (b) => b.rawString(name).number(position));
    } else if (result.type === 'action') {
      this.game.log('MarsBot: ${0} track to ${1}, action: ${2}',
        (b) => b.rawString(name).number(position).rawString(result.action));
      this.resolveTrackAction(result.action, trackIndex);
    } else {
      this.game.log('MarsBot: ${0} track to ${1}',
        (b) => b.rawString(name).number(position));
    }

    if (!reAdvance) {
      this.marsBotManager?.notifyTrackSpaceResolved(trackIndex, position);
    }
    return true;
  }

  /**
   * Advance the track for a tag, for a track or bonus effect that names the tag.
   * Returns false when no track takes that tag.
   */
  public advanceTrackOfTag(tag: Tag): boolean {
    const trackIndex = this.marsBotBoard.tagToTrack[tag];
    if (trackIndex === undefined) {
      return false;
    }
    if (this.advanceTrack(trackIndex)) {
      this.notifyTagAdvance(tag);
    }
    return true;
  }

  /**
   * Tells the player's cards about an advance that names `tag`, as if a card with that tag was played.
   *
   * A microbe advance resolves Pharmacy Union or Splice (FAQ, rulebook B p.4), and a Jovian one
   * Saturn Systems (TDaver, BGG 3356105). The other tags on a shared track don't count.
   */
  public notifyTagAdvance(tag: Tag): void {
    const cards = tag === Tag.MICROBE ? [CardName.PHARMACY_UNION, CardName.SPLICE] :
      tag === Tag.JOVIAN ? [CardName.SATURN_SYSTEMS] : [];
    if (cards.length > 0) {
      this.notifyPlayerCards({tags: [tag]} as Partial<ICard> as ICard, cards);
    }
  }

  /** Resolve an action icon on a track position. */
  private resolveTrackAction(action: TrackAction, currentTrackIndex: number): void {
    // Parse TR value
    const trMatch = action.match(/^tr(\d+)$/);
    if (trMatch) {
      const amount = parseInt(trMatch[1], 10);
      this.botPlayer.increaseTerraformRating(amount);
      this.game.log('MarsBot gains ${0} TR', (b) => b.number(amount));
      return;
    }

    // Parse tag_N (advance another track by index or tag name)
    if (action.startsWith('tag_')) {
      const value = action.substring(4);
      const numericIndex = parseInt(value, 10);
      if (!isNaN(numericIndex)) {
        this.advanceTrack(numericIndex);
      } else {
        this.advanceTrackOfTag(value as Tag);
      }
      return;
    }

    switch (action) {
    case 'advance':
      if (this.difficulty === 'easy') {
        return;
      } // Easy mode ignores advance actions
      this.advanceTrack(currentTrackIndex);
      return;

    case 'milestone':
      if (!this.marsBotManager?.maybeClaimMilestone()) {
        this.failedAction();
      }
      return;

    case 'award':
      if (!this.marsBotManager?.maybeFundAward()) {
        this.failedAction();
      }
      return;

    case 'temperature':
      this.raiseTemperature(1);
      return;

    case 'temperature2':
      this.raiseTemperature(2);
      return;

    case 'greenery':
      this.placeGreenery();
      return;

    case 'ocean':
      this.placeOcean();
      return;

    case 'city':
      this.placeCity();
      return;

    case 'floater':
      this.gainFloaters(1);
      return;

    case 'floater2':
      this.gainFloaters(2);
      return;

    case 'venus':
      if (!this.game.gameOptions.venusNextExtension) {
        return;
      }
      this.raiseVenus(1);
      return;

    case 'venus2':
      if (!this.game.gameOptions.venusNextExtension) {
        return;
      }
      this.raiseVenus(2);
      return;

    case 'colony':
      this.placeColony();
      return;
    }
  }

  // ---- Terraforming Actions ----

  /** Raises the temperature, or takes a Failed Action when it is already at its maximum. */
  public raiseTemperature(steps: 1 | 2): void {
    if (this.game.getTemperature() >= this.game.max.temperature) {
      this.failedAction();
      return;
    }
    this.marsBotManager?.raiseTemperature(steps);
  }

  public placeGreenery(): void {
    const space = this.tilePlacer.findGreenerySpace();
    if (space === undefined) {
      this.failedAction();
      return;
    }

    // Place tile and raise oxygen (unless the corp intercepts the raise)
    const raiseOxygen = this.game.getOxygenLevel() >= this.game.max.oxygen ||
      !this.interceptsRaise(GlobalParameter.OXYGEN);
    this.game.addGreenery(this.botPlayer, space, raiseOxygen);

    // MarsBot placement bonuses: 1 MC per icon, 2 MC per adjacent ocean
    this.gainMc(this.tilePlacer.getTotalPlacementMC(space));
    this.game.log('MarsBot places greenery');
  }

  public placeOcean(): void {
    if (!this.game.canAddOcean()) {
      this.failedAction();
      return;
    }
    const space = this.tilePlacer.findOceanSpace();
    if (space === undefined) {
      this.failedAction();
      return;
    }

    if (this.interceptsRaise(GlobalParameter.OCEANS)) {
      return;
    }
    this.game.addOcean(this.botPlayer, space);

    // MarsBot placement bonuses
    this.gainMc(this.tilePlacer.getTotalPlacementMC(space));
    this.game.log('MarsBot places ocean');
  }

  public placeCity(): void {
    const space = this.tilePlacer.findCitySpace();
    if (space === undefined) {
      this.failedAction();
      return;
    }

    this.game.addCity(this.botPlayer, space);

    // MarsBot placement bonuses
    this.gainMc(this.tilePlacer.getTotalPlacementMC(space));
    this.game.log('MarsBot places city');
  }

  /** Like raiseTemperature: Pristar's cube cancels only the first step. */
  private raiseVenus(steps: 1 | 2): void {
    if (this.game.getVenusScaleLevel() >= this.game.max.venus) {
      this.failedAction();
      return;
    }
    const taken = this.interceptsRaise(GlobalParameter.VENUS) ? steps - 1 : steps;
    if (taken === 0) {
      return;
    }
    this.game.increaseVenusScaleLevel(this.botPlayer, taken as 1 | 2);
    this.game.log('MarsBot raises Venus ${0} step(s)', (b) => b.number(taken));
  }

  // C-8/C-14: Gain `count` floaters. With Venus → floaters; without Venus but with Colonies and
  // Titan dealt → Titan storage; otherwise ignored (C-13; Nick, BGG 3341542).
  public gainFloaters(count: number): void {
    if (this.marsBotManager === undefined) {
      return;
    }
    if (this.game.gameOptions.venusNextExtension) {
      this.marsBotManager.floaters += count;
      this.game.log('MarsBot gains ${0} floater(s)', (b) => b.number(count));
    } else if (this.game.gameOptions.coloniesExtension && this.game.colonies.some((colony) => colony.name === ColonyName.TITAN)) {
      this.marsBotManager.shippingBoard.add(ColonyName.TITAN, count);
      this.game.log('MarsBot gains ${0} floater token(s) in Titan storage (C-14)', (b) => b.number(count));
    }
  }

  // Utopia Planitia's colony icon and Amazonis Planitia's Venus colony bonus: build like Outer
  // System Foothold, ignored without Colonies.
  public placeColony(): void {
    if (!this.game.gameOptions.coloniesExtension || this.marsBotManager === undefined) {
      return;
    }
    const colony = selectRandomColony(this.marsBotManager);
    if (colony === undefined) {
      this.game.log('MarsBot: no colony tile to build on, Failed Action');
      this.failedAction();
      return;
    }
    placeColonyForMarsBot(colony, this.marsBotManager);
  }

  // ---- Utilities ----

  /** The M€ a Failed Action pays at this difficulty. */
  public get failedActionMc(): number {
    return this.difficulty === 'easy' ? FAILED_ACTION_MC_EASY : FAILED_ACTION_MC;
  }

  public failedAction(): void {
    const mc = this.failedActionMc;
    this.gainMc(mc);
    this.game.log('MarsBot takes a Failed Action, gains ${0} MC', (b) => b.number(mc));
    this.marsBotManager?.notifyFailedAction();
  }

  /** Add M€ to MarsBot's supply and tell the corp about it (Mining Guild). */
  public gainMc(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.megacredits += amount;
    this.marsBotManager?.corp?.onMcGained?.(this.marsBotManager, amount);
  }

  /** Pristar: true when the corp consumes its cube to skip this raise. */
  private interceptsRaise(parameter: GlobalParameter): boolean {
    return this.marsBotManager?.interceptsParameterRaise(parameter) ?? false;
  }
}
