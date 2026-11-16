import {BoardName} from '../../common/boards/BoardName';
import {MARSBOT_GOAL_NEEDS, MarsBotGoalNeed} from '../../common/automa/MarsBotGoals';
import {AwardName} from '../../common/ma/AwardName';
import {MilestoneName} from '../../common/ma/MilestoneName';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../game/GameOptions';
import {AutomaGameSetup} from './AutomaGameSetup';

/**
 * What a game must have before MarsBot can play a hand-picked milestone, or undefined when it can't in any game.
 *
 * The client gets this with each milestone, so the create game form can tell what `AutomaGameSetup.supportsMilestone`
 * will accept.
 */
export function marsBotMilestoneNeeds(name: MilestoneName): ReadonlyArray<MarsBotGoalNeed> | undefined {
  return goalNeeds((options) => AutomaGameSetup.supportsMilestone(name, options));
}

/** As `marsBotMilestoneNeeds`, for an award. */
export function marsBotAwardNeeds(name: AwardName): ReadonlyArray<MarsBotGoalNeed> | undefined {
  return goalNeeds((options) => AutomaGameSetup.supportsAward(name, options));
}

/** Asks `supported` about a game that has everything, then about games that each lack one thing. */
function goalNeeds(supported: (options: GameOptions) => boolean): ReadonlyArray<MarsBotGoalNeed> | undefined {
  if (!supported(gameWith(MARSBOT_GOAL_NEEDS))) {
    return undefined;
  }
  return MARSBOT_GOAL_NEEDS.filter((need) => !supported(gameWith(MARSBOT_GOAL_NEEDS.filter((other) => other !== need))));
}

/** A game with hand-picked milestones and awards that has only what `present` lists. */
function gameWith(present: ReadonlyArray<MarsBotGoalNeed>): GameOptions {
  return {
    ...DEFAULT_GAME_OPTIONS,
    venusNextExtension: present.includes('venus'),
    turmoilExtension: present.includes('turmoil'),
    boardName: present.includes('amazonisPlanitia') ? BoardName.AMAZONIS_PLANITIA : BoardName.THARSIS,
    modularMA: false,
  };
}
