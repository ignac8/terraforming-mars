import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {Tag} from '../../common/cards/Tag';
import {GlobalParameter} from '../../common/GlobalParameter';
import {CardType} from '../../common/cards/CardType';
import {ColonyName} from '../../common/colonies/ColonyName';
import {
  TrackAction,
  FAILED_ACTION_MC,
  FAILED_ACTION_MC_EASY,
  DifficultyLevel,
} from '../../common/automa/AutomaTypes';
import {MarsBotBoard} from './MarsBotBoard';
import {MarsBotTilePlacer} from './MarsBotTilePlacer';
import {IMilestone} from '../milestones/IMilestone';
import {IAward} from '../awards/IAward';
import {Resource} from '../../common/Resource';
import * as constants from '../../common/constants';
import {MarsBotCorpResolver} from './corps/MarsBotCorpResolver';
import {MILESTONE_EVALS, AWARD_EVALS} from './MarsBotMilestoneAwardEval';
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

  /** Resolve a project card: advance tracks based on tags. */
  public resolveProjectCard(card: IProjectCard): void {
    this.game.log('MarsBot plays ${0}', (b) => b.card(card));

    // Build the effective tag list: card.tags + Event tag if the card is an event type.
    // In the physical game, event cards show the Event tag icon on the top-right.
    // In the codebase, card.tags does NOT include Tag.EVENT for event-type cards.
    const tags: Array<Tag> = [...card.tags];
    if (card.type === CardType.EVENT && !tags.includes(Tag.EVENT)) {
      tags.push(Tag.EVENT);
    }

    if (tags.length === 0) {
      this.game.log('MarsBot takes a Failed Action (card has no tags)');
      this.failedAction();
      return;
    }

    // Resolve each tag left-to-right
    let advancedAny = false;
    for (const tag of tags) {
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
    for (const effectCard of this.humanPlayer.playedCards) {
      this.humanPlayer.defer(effectCard.onCardPlayedByAnyPlayer?.(this.humanPlayer, card, this.marsBot));
    }

    // Card goes to MarsBot's played pile (for Hard mode scoring)
    this.game.projectDeck.discardPile.push(card);
  }

  // ---- Track Advancement ----

  private trackName(trackIndex: number): string {
    return this.marsBotBoard.tracks[trackIndex]?.definition.tags[0] ?? `Track ${trackIndex}`;
  }

  /** Advance a track by index. Handles chain actions. */
  public advanceTrack(trackIndex: number): void {
    const track = this.marsBotBoard.tracks[trackIndex];
    const name = this.trackName(trackIndex);

    const result = track.advance();

    if (result.type === 'maxed') {
      this.game.log('MarsBot: ${0} track at max, Failed Action', (b) => b.rawString(name));
      this.failedAction();
      return;
    }

    // Cube trigger — fires BEFORE track icon resolution (corp cubes, colony cubes, trade fleet cube)
    if (this.marsBotManager !== undefined) {
      MarsBotCorpResolver.onTrackAdvanced(this.marsBotManager, trackIndex, track.position);
    }

    if (result.type === 'action') {
      this.game.log('MarsBot: ${0} track to ${1}, action: ${2}',
        (b) => b.rawString(name).number(track.position).rawString(result.action));
      this.resolveTrackAction(result.action, trackIndex);
    } else {
      this.game.log('MarsBot: ${0} track to ${1}',
        (b) => b.rawString(name).number(track.position));
    }
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
        const tagIndex = this.marsBotBoard.tagToTrack[value as Tag];
        if (tagIndex !== undefined) {
          this.advanceTrack(tagIndex);
        }
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
      this.tryClaimMilestone();
      return;

    case 'award':
      this.tryFundAward();
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
    }
  }

  // ---- Terraforming Actions ----

  private raiseTemperature(steps: number): void {
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
  private gainFloaters(count: number): void {
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

  // ---- Milestones & Awards ----

  private tryClaimMilestone(): void {
    const claimable = this.getClaimableMilestones();
    if (claimable.length === 0) {
      this.failedAction();
      return;
    }

    // Tiebreakers: 1) one human also qualifies for, 2) one human is closest to, 3) leftmost (Hoverlord last)
    // Sort so Hoverlord is last in "leftmost" priority when tied
    const sorted = claimable.sort((a, b) => {
      if (a.name === 'Hoverlord') {
        return 1;
      }
      if (b.name === 'Hoverlord') {
        return -1;
      }
      return 0;
    });
    let best = sorted[0]; // Default: leftmost (Hoverlord pushed to end)

    // Tiebreaker 1: prefer milestones the human also qualifies for
    const humanAlsoQualifies = sorted.filter((m) => m.canClaim(this.humanPlayer));
    if (humanAlsoQualifies.length > 0) {
      best = humanAlsoQualifies[0];
    } else {
      // Tiebreaker 2: whichever the human is closest to meeting
      let bestCloseness = -Infinity;
      for (const m of sorted) {
        const closeness = this.humanMilestoneCloseness(m);
        if (closeness > bestCloseness) {
          bestCloseness = closeness;
          best = m;
        }
      }
    }

    this.game.claimedMilestones.push({player: this.marsBot, milestone: best});
    this.game.log('MarsBot claims milestone ${0}', (b) => b.rawString(best.name));

    // Briber milestone: lose 12 MC on claim
    if (best.name === 'Briber') {
      this.megacredits = Math.max(0, this.megacredits - 12);
      this.game.log('MarsBot loses 12 MC (Briber)');
    }
  }

  private getClaimableMilestones(): Array<IMilestone> {
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

  /** Estimate how close the human player is to meeting a milestone (higher = closer). */
  private humanMilestoneCloseness(milestone: IMilestone): number {
    const name = milestone.name;
    switch (name) {
    case 'Terraformer': return this.humanPlayer.terraformRating; // closer to 35
    case 'Mayor': return this.game.board.getCities(this.humanPlayer).length;
    case 'Gardener': return this.game.board.getGreeneries(this.humanPlayer).length;
    case 'Builder': return this.humanPlayer.tags.count(Tag.BUILDING, 'raw'); // closer to 8
    case 'Planner': return this.humanPlayer.cardsInHand.length + this.humanPlayer.playedCards.length; // closer to 16
    default: return 0;
    }
  }

  /** Check if MarsBot meets a milestone using track-based criteria. */
  public marsBotMeetsMilestone(milestone: IMilestone): boolean {
    const evalFn = MILESTONE_EVALS.get(milestone.name);
    if (evalFn !== undefined && this.marsBotManager !== undefined) {
      const result = evalFn(this.marsBotManager);
      if (result !== undefined) {
        return result;
      }
    }
    return milestone.canClaim(this.marsBot);
  }

  private tryFundAward(): void {
    if (this.game.allAwardsFunded()) {
      this.failedAction();
      return;
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
      this.failedAction();
      return;
    }

    this.game.fundAward(this.marsBot, bestAward);
    this.game.log('MarsBot funds award ${0}', (b) => b.rawString(bestAward.name));
  }

  /** Get MarsBot's value for an award using track-based evaluation. */
  public getMarsBotAwardValue(award: IAward): number {
    const offset = this.difficulty === 'easy' ? -5 : 0;
    const evalFn = AWARD_EVALS.get(award.name);
    if (evalFn !== undefined && this.marsBotManager !== undefined) {
      const result = evalFn(this.marsBotManager);
      if (result !== undefined) {
        return result + offset;
      }
    }
    return award.getScore(this.marsBot) + offset;
  }

  /**
   * Per rules page 8: "MarsBot considers your current number of resources plus your production"
   * for resource-based awards like Thermalist (heat) and Miner (steel+titanium).
   */
  private getHumanAwardValueForComparison(award: IAward): number {
    const name = award.name;
    switch (name) {
    case 'Thermalist':
      return this.humanPlayer.heat + this.humanPlayer.production.get(Resource.HEAT);
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
