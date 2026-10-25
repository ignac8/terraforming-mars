import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Biologist implements IAward {
  public readonly name = 'Biologist';
  public readonly description = 'Have the most animal, plant, and microbe tags in play';

  public getScore(player: IPlayer): number {
    return player.tags.multipleCount([Tag.MICROBE, Tag.PLANT, Tag.ANIMAL], 'award');
  }

  /** Scores the Bio track space plus 5 (rulebook C, p.14). */
  public marsBotScore(bot: IMarsBot): number {
    return marsBotTrackPosition(bot, Tag.PLANT) + 5;
  }
}
