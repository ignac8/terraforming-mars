import {IAward} from '../IAward';
import {IPlayer} from '../../IPlayer';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Botanist implements IAward {
  public readonly name = 'Botanist';
  public readonly description = 'Have the most plant production';
  public getScore(player: IPlayer): number {
    return player.production.plants;
  }

  /** Scores the Bio track space minus 2, but not less than 0 (rulebook C, pp.10, 14). */
  public marsBotScore(bot: IMarsBot): number {
    return Math.max(0, marsBotTrackPosition(bot, Tag.PLANT) - 2);
  }
}
