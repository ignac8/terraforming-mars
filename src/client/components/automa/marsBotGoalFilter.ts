import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {MarsBotGoalGame, marsBotCanPlayGoal} from '@/common/automa/MarsBotGoals';
import {AwardName} from '@/common/ma/AwardName';
import {MilestoneName, milestoneNames} from '@/common/ma/MilestoneName';

function isMilestoneName(name: MilestoneName | AwardName): name is MilestoneName {
  return (milestoneNames as ReadonlyArray<string>).includes(name);
}

/** Whether MarsBot can play a hand-picked milestone or award in `game`. No name is both a milestone and an award. */
export function marsBotCanPlay(name: MilestoneName | AwardName, game: MarsBotGoalGame): boolean {
  const goal = isMilestoneName(name) ? getMilestone(name) : getAward(name);
  return marsBotCanPlayGoal(goal.automaNeeds, game);
}
