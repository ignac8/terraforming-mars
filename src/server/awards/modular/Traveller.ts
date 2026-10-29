import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {Tag} from '../../../common/cards/Tag';
import {IMarsBot} from '../../automa/MarsBotCorpTypes';

export class Traveller implements IAward {
  public readonly name = 'Traveller';
  public readonly description = 'Have the most Jovian and Earth tags in play combined';
  public getScore(player: IPlayer): number {
    return player.tags.multipleCount([Tag.JOVIAN, Tag.EARTH], 'award');
  }

  /** The automa rules score the higher of MarsBot's Jovian and earth tracks, plus 5. */
  public marsBotScore(bot: IMarsBot): number {
    return Math.max(bot.marsBotBoard.trackPosition(Tag.JOVIAN), bot.marsBotBoard.trackPosition(Tag.EARTH)) + 5;
  }
}
