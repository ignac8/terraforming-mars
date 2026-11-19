import {IMilestone} from '@/server/milestones/IMilestone';
import {IPlayer} from '@/server/IPlayer';
import {IAward} from '@/server/awards/IAward';
import {BoardName} from '@/common/boards/BoardName';
import {marsBotMapSet} from '@/common/automa/marsBotMapSet';
import {IMarsBot} from '@/server/automa/IMarsBot';

/**
 * Whether MarsBot follows `boardName`'s own milestone and award rules.
 *
 * That holds on `boardName` unless the game plays the Milestones & Awards expansion, whose rules
 * are written against the Tharsis board whatever map the game is played on. Random milestones
 * and awards keep the map's rules.
 */
export function marsBotUsesBoardGoals(marsBot: IMarsBot, boardName: BoardName): boolean {
  return marsBotMapSet(marsBot.game.gameOptions) === boardName;
}

/**
 * MarsBot claims milestones and scores awards through the ordinary IMilestone and IAward
 * code, called with its player. That works because the bot's player answers tag counts and
 * production from its board tracks. The few milestones and awards where the automa rules
 * say something else override marsBotCanClaim or marsBotScore on their own class.
 */
export function marsBotCanClaimMilestone(milestone: IMilestone, marsBot: IMarsBot): boolean {
  return milestone.marsBotCanClaim?.(marsBot) ?? milestone.canClaim(marsBot.player);
}

/**
 * How far `player` is from meeting a milestone, for MarsBot's "closest to meeting the criteria"
 * tiebreaker. A milestone that can't be counted is 0 away when the player qualifies and
 * infinitely far otherwise.
 */
export function milestoneRemaining(milestone: IMilestone, player: IPlayer): number {
  if (milestone.remaining !== undefined) {
    return milestone.remaining(player);
  }
  return milestone.canClaim(player) ? 0 : Infinity;
}

export function marsBotAwardScore(award: IAward, marsBot: IMarsBot): number {
  return award.marsBotScore?.(marsBot) ?? award.getScore(marsBot.player);
}
