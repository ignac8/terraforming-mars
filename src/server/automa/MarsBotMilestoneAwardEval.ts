import {Tag} from '../../common/cards/Tag';
import {BoardName} from '../../common/boards/BoardName';
import {marsBotMapSet} from '../../common/automa/MarsBotMADescriptions';
import {IMilestone} from '../milestones/IMilestone';
import {IPlayer} from '../IPlayer';
import {IAward} from '../awards/IAward';
import {IMarsBot} from './MarsBotCorpTypes';

/**
 * MarsBot claims milestones and scores awards through the ordinary IMilestone and IAward
 * code, called with its player. That works because the bot's player answers tag counts and
 * production from its board tracks. The few milestones and awards where the automa rules
 * say something else override marsBotCanClaim or marsBotScore on their own class.
 */
export function marsBotCanClaimMilestone(milestone: IMilestone, bot: IMarsBot): boolean {
  return milestone.marsBotCanClaim?.(bot) ?? milestone.canClaim(bot.player);
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

export function marsBotAwardScore(award: IAward, bot: IMarsBot): number {
  return award.marsBotScore?.(bot) ?? award.getScore(bot.player);
}

/** Every track position, the Venus track included when in play. */
export function marsBotAllTrackPositions(bot: IMarsBot): Array<number> {
  return bot.marsBotBoard.tracks.map((track) => track.position);
}

/** The Mars track positions, leaving a Venus track out. */
export function marsBotMarsTrackPositions(bot: IMarsBot): Array<number> {
  return bot.marsBotBoard.tracks
    .filter((track) => !track.definition.tags.includes(Tag.VENUS))
    .map((track) => track.position);
}

/**
 * Whether the game plays `boardName`'s own milestone and award set. Then the rulebook's map
 * rules apply. With random or modular milestones and awards MarsBot follows the modular
 * rules, which are written against the Tharsis board whatever map the game is played on.
 */
export function marsBotUsesMapSet(bot: IMarsBot, boardName: BoardName): boolean {
  return marsBotMapSet(bot.game.gameOptions) === boardName;
}
