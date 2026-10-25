import {IPlayer} from '../IPlayer';
import {IAward} from './IAward';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Blacksmith implements IAward {
  public readonly name = 'Blacksmith';
  public readonly description = 'Have the highest production of steel and titanium combined';

  public getScore(player: IPlayer): number {
    return player.production.steel + player.production.titanium;
  }

  /** Scores the higher of the Building and Space track spaces (rulebook C, p.10). */
  public marsBotScore(bot: IMarsBot): number {
    return Math.max(marsBotTrackPosition(bot, Tag.BUILDING), marsBotTrackPosition(bot, Tag.SPACE));
  }
}
