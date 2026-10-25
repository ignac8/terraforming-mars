import {IAward} from '../IAward';
import {IPlayer} from '../../IPlayer';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Promoter implements IAward {
  public readonly name = 'Promoter';
  public readonly description = 'Have the most cards in your event pile';

  public getScore(player: IPlayer): number {
    return player.getPlayedEventsCount();
  }

  /** Scores the Event track space (rulebook C, pp.10, 15). */
  public marsBotScore(bot: IMarsBot): number {
    return marsBotTrackPosition(bot, Tag.EVENT);
  }
}
