import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {Tag} from '../../../common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Traveller implements IAward {
  public readonly name = 'Traveller';
  public readonly description = 'Have the most Jovian and Earth tags in play combined';
  public getScore(player: IPlayer): number {
    return player.tags.multipleCount([Tag.JOVIAN, Tag.EARTH], 'award');
  }

  /**
   * Scores the higher of the Jovian and Earth track spaces plus 5 (rulebook C, pp.10, 15).
   */
  public marsBotScore(bot: IMarsBot): number {
    return Math.max(marsBotTrackPosition(bot, Tag.JOVIAN), marsBotTrackPosition(bot, Tag.EARTH)) + 5;
  }
}
