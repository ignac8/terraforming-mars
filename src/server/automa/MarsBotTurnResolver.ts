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
import {marsBotCardTags} from './MarsBotTags';
import {MarsBotTilePlacer} from './MarsBotTilePlacer';
import {IMilestone} from '../milestones/IMilestone';
import {IAward} from '../awards/IAward';
import {Resource} from '../../common/Resource';
import * as constants from '../../common/constants';
import {MarsBotCorpResolver} from './corps/MarsBotCorpResolver';
import {placeColonyForMarsBot, selectRandomColony} from './colonies/MarsBotColonyPlacer';
import {marsBotCanClaimMilestone, marsBotAwardScore, milestoneRemaining} from './MarsBotMilestoneAwardEval';
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
    private readonly marsBot: IPlayer,
    private readonly humanPlayer: IPlayer,
    public readonly marsBotBoard: MarsBotBoard,
    private readonly difficulty: DifficultyLevel,
    public megacredits: number = 0,
    tilePlacer?: MarsBotTilePlacer,
  ) {
    this.tilePlacer = tilePlacer ?? new MarsBotTilePlacer(game, marsBot, humanPlayer);
  }

  // ---- Project Card Resolution ----

  /**
   * Resolve a project card: advance tracks based on tags. With `firstTagOnly` the other tags are
   * ignored (Thorgate), but the whole card goes to the played pile.
   */
  public resolveProjectCard(original: IProjectCard, firstTagOnly: boolean = false): void {
    this.game.log('MarsBot plays ${0}', (b) => b.card(original));
    // Every resolved project card goes to MarsBot's played pile (rulebook A, p.5), not the project
    // discard pile, so it can't be drawn again
    this.marsBotManager?.playedProjectCards.push(original);

    const allTags = marsBotCardTags(original);
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
      this.marsBotManager?.corp?.effect?.onTagResolved?.(this.marsBotManager, tag);
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
    this.marsBotManager?.corp?.effect?.onProjectCardResolved?.(this.marsBotManager, card);

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
      this.humanPlayer.defer(effectCard.onCardPlayedByAnyPlayer?.(this.humanPlayer, played, this.marsBot));
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
   */
  public advanceTrack(trackIndex: number): boolean {
    const track = this.marsBotBoard.tracks[trackIndex];
    const name = this.trackName(trackIndex);
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
    if (this.marsBotManager !== undefined &&
        MarsBotCorpResolver.onTrackAdvanced(this.marsBotManager, trackIndex, position)) {
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

    if (this.marsBotManager !== undefined && !reAdvance) {
      this.marsBotManager.corp?.effect?.afterTrackSpaceResolved?.(this.marsBotManager, trackIndex, position);
    }
    return true;
  }

  /**
   * Advance the track for a tag, for a track or bonus effect that names the tag.
   * Returns false when no track takes that tag.
   *
   * FAQ (rulebook B, p.3): a microbe advancement resolves the player's Pharmacy Union or
   * Splice as if a card with a microbe tag was played. Plant and animal advances on the
   * shared track don't, and other cards (Saturn Systems) only react to played cards.
   */
  public advanceTrackOfTag(tag: Tag): boolean {
    const trackIndex = this.marsBotBoard.tagToTrack[tag];
    if (trackIndex === undefined) {
      return false;
    }
    if (this.advanceTrack(trackIndex) && tag === Tag.MICROBE) {
      const microbeCard = {tags: [Tag.MICROBE]} as Partial<ICard> as ICard;
      this.notifyPlayerCards(microbeCard, [CardName.PHARMACY_UNION, CardName.SPLICE]);
    }
    return true;
  }

  /** Resolve an action icon on a track position. */
  private resolveTrackAction(action: TrackAction, currentTrackIndex: number): void {
    // Parse TR value
    const trMatch = action.match(/^tr(\d+)$/);
    if (trMatch) {
      const amount = parseInt(trMatch[1], 10);
      this.marsBot.increaseTerraformRating(amount);
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
      if (!this.maybeClaimMilestone()) {
        this.failedAction();
      }
      return;

    case 'award':
      if (!this.maybeFundAward()) {
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

  public raiseTemperature(steps: number): void {
    if (this.game.getTemperature() >= constants.MAX_TEMPERATURE) {
      this.failedAction();
      return;
    }
    if (this.interceptsRaise(GlobalParameter.TEMPERATURE)) {
      return;
    }
    const increment = steps as 1 | 2;
    this.game.increaseTemperature(this.marsBot, increment);
    if (this.marsBotManager) {
      this.marsBotManager.temperatureRaises += steps;
    }
    this.game.log('MarsBot raises temperature ${0} step(s)', (b) => b.number(steps));
    // Temperature bonuses at -24C and -20C: MarsBot gains 2 MC instead of heat production
    // This is handled by the game engine granting heat production; we override in MarsBot's production
    // Since MarsBot doesn't use production, we grant 2 MC for each heat bonus step hit.
  }

  public placeGreenery(): void {
    const space = this.tilePlacer.findGreenerySpace();
    if (space === undefined) {
      this.failedAction();
      return;
    }

    // Place tile and raise oxygen (unless the corp intercepts the raise)
    const raiseOxygen = this.game.getOxygenLevel() >= constants.MAX_OXYGEN_LEVEL ||
      !this.interceptsRaise(GlobalParameter.OXYGEN);
    this.game.addGreenery(this.marsBot, space, raiseOxygen);

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
    this.game.addOcean(this.marsBot, space);

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

    this.game.addCity(this.marsBot, space);

    // MarsBot placement bonuses
    this.gainMc(this.tilePlacer.getTotalPlacementMC(space));
    this.game.log('MarsBot places city');
  }

  private raiseVenus(steps: number): void {
    if (this.game.getVenusScaleLevel() >= constants.MAX_VENUS_SCALE) {
      this.failedAction();
      return;
    }
    if (this.interceptsRaise(GlobalParameter.VENUS)) {
      return;
    }
    this.game.increaseVenusScaleLevel(this.marsBot, steps as 1 | 2);
    this.game.log('MarsBot raises Venus ${0} step(s)', (b) => b.number(steps));
  }

  // C-8/C-14: Gain `count` floaters. With Venus → floaters; without Venus but with Colonies →
  // Titan storage; without both → ignored (C-13).
  public gainFloaters(count: number): void {
    if (this.marsBotManager === undefined) {
      return;
    }
    if (this.game.gameOptions.venusNextExtension) {
      this.marsBotManager.floaters += count;
      this.game.log('MarsBot gains ${0} floater(s)', (b) => b.number(count));
    } else if (this.game.gameOptions.coloniesExtension) {
      this.marsBotManager.shippingBoard.add(ColonyName.TITAN, count, this.marsBotManager);
      this.game.log('MarsBot gains ${0} floater token(s) in Titan storage (C-14)', (b) => b.number(count));
    }
  }

  // Utopia Planitia's colony icon: build like Outer System Foothold, ignored without Colonies.
  private placeColony(): void {
    if (!this.game.gameOptions.coloniesExtension || this.marsBotManager === undefined) {
      return;
    }
    const colony = selectRandomColony(this.game, this.marsBotManager);
    if (colony === undefined) {
      this.game.log('MarsBot: no colony tile to build on, Failed Action');
      this.failedAction();
      return;
    }
    placeColonyForMarsBot(colony, this.marsBotManager);
    this.game.log('MarsBot places a colony on ${0}', (b) => b.colony(colony));
  }

  // ---- Milestones & Awards ----

  /** Claims the best milestone MarsBot meets. False when it meets none. */
  public maybeClaimMilestone(): boolean {
    const best = this.selectMilestone(this.getClaimableMilestones());
    if (best === undefined) {
      return false;
    }

    this.game.claimedMilestones.push({player: this.marsBot, milestone: best});
    this.game.log('MarsBot claims milestone ${0}', (b) => b.rawString(best.name));

    // Briber milestone: lose 12 MC on claim
    if (best.name === 'Briber') {
      this.megacredits = Math.max(0, this.megacredits - 12);
      this.game.log('MarsBot loses 12 MC (Briber)');
    }
    return true;
  }

  /**
   * Picks the milestone to claim from those MarsBot meets, by the tiebreakers on page 8:
   * 1) one the human also meets, 2) the one the human is closest to meeting, 3) leftmost
   * (Hoverlord last).
   */
  public selectMilestone(claimable: ReadonlyArray<IMilestone>): IMilestone | undefined {
    const sorted = claimable.toSorted((a, b) => {
      if (a.name === 'Hoverlord') {
        return 1;
      }
      if (b.name === 'Hoverlord') {
        return -1;
      }
      return 0;
    });

    const humanAlsoQualifies = sorted.filter((m) => m.canClaim(this.humanPlayer));
    if (humanAlsoQualifies.length > 0) {
      return humanAlsoQualifies[0];
    }

    let best: IMilestone | undefined;
    let bestRemaining = Infinity;
    for (const m of sorted) {
      const remaining = milestoneRemaining(m, this.humanPlayer);
      if (best === undefined || remaining < bestRemaining) {
        bestRemaining = remaining;
        best = m;
      }
    }
    return best;
  }

  public getClaimableMilestones(): Array<IMilestone> {
    if (this.game.allMilestonesClaimed()) {
      return [];
    }
    return this.game.milestones.filter((m) => {
      if (this.game.milestoneClaimed(m)) {
        return false;
      }
      return this.marsBotMeetsMilestone(m);
    });
  }

  /** Check if MarsBot meets a milestone. */
  public marsBotMeetsMilestone(milestone: IMilestone): boolean {
    if (this.marsBotManager !== undefined) {
      return marsBotCanClaimMilestone(milestone, this.marsBotManager);
    }
    return milestone.canClaim(this.marsBot);
  }

  /** Funds the unfunded award MarsBot leads the player by the most. False when it leads none. */
  public maybeFundAward(): boolean {
    if (this.game.allAwardsFunded()) {
      return false;
    }

    const unfunded = this.game.awards.filter((a) => !this.game.hasBeenFunded(a));
    // Find the award where MarsBot is most ahead of the human
    let bestAward: IAward | undefined;
    let bestMargin = -Infinity;

    for (const award of unfunded) {
      const marsBotValue = this.getMarsBotAwardValue(award);
      // Per rules (page 8): "MarsBot considers your current number of resources plus your production"
      const humanValue = this.getHumanAwardValueForComparison(award);
      const margin = marsBotValue - humanValue;
      if (margin > bestMargin || (margin === bestMargin && bestAward?.name === 'Venuphile')) {
        bestMargin = margin;
        bestAward = award;
      }
    }

    if (bestAward === undefined || bestMargin <= 0) {
      // MarsBot is not ahead on any award
      return false;
    }

    this.game.fundAward(this.marsBot, bestAward);
    this.game.log('MarsBot funds award ${0}', (b) => b.rawString(bestAward.name));
    return true;
  }

  /** Get MarsBot's value for an award, with the easy difficulty handicap and its corp's bonus (Nirgal). */
  public getMarsBotAwardValue(award: IAward): number {
    const offset = this.difficulty === 'easy' ? -5 : 0;
    const bot = this.marsBotManager;
    if (bot !== undefined) {
      const corpBonus = bot.corp?.effect?.awardScoreBonus?.(bot) ?? 0;
      return marsBotAwardScore(award, bot) + offset + corpBonus;
    }
    return award.getScore(this.marsBot) + offset;
  }

  /**
   * Per rules page 8: "MarsBot considers your current number of resources plus your production"
   * for resource-based awards like Thermalist (heat) and Miner (steel+titanium).
   */
  public getHumanAwardValueForComparison(award: IAward): number {
    const name = award.name;
    switch (name) {
    case 'Thermalist':
      // Heat resources + energy resources (they become heat) + heat production. Energy
      // production doesn't count; designer ruling, BGG thread 3350125 (TDaver).
      return this.humanPlayer.heat + this.humanPlayer.energy + this.humanPlayer.production.get(Resource.HEAT);
    case 'Miner':
      return this.humanPlayer.steel + this.humanPlayer.titanium +
        this.humanPlayer.production.get(Resource.STEEL) + this.humanPlayer.production.get(Resource.TITANIUM);
    default:
      return award.getScore(this.humanPlayer);
    }
  }

  // ---- Utilities ----

  public failedAction(): void {
    const mc = this.difficulty === 'easy' ? FAILED_ACTION_MC_EASY : FAILED_ACTION_MC;
    this.gainMc(mc);
    this.game.log('MarsBot takes a Failed Action, gains ${0} MC', (b) => b.number(mc));
    this.marsBotManager?.corp?.effect?.onFailedAction?.(this.marsBotManager);
  }

  /** Add M€ to MarsBot's supply and tell the corp about it (Mining Guild). */
  public gainMc(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.megacredits += amount;
    this.marsBotManager?.corp?.effect?.onMcGained?.(this.marsBotManager, amount);
  }

  /** Pristar: true when the corp consumes its cube to skip this raise. */
  private interceptsRaise(parameter: GlobalParameter): boolean {
    return this.marsBotManager?.interceptsParameterRaise(parameter) ?? false;
  }
}
