import {IAward} from '../IAward';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {IMarsBot} from '../../automa/MarsBotCorpTypes';

export class Botanist implements IAward {
  public readonly name = 'Botanist';
  public readonly description = 'Have the most plant production';
  public getScore(player: IPlayer): number {
    return player.production.plants;
  }

  /** The automa rules score MarsBot's Botanist as its bio track minus 2. */
  public marsBotScore(bot: IMarsBot): number {
    return Math.max(0, bot.marsBotBoard.trackPosition(Tag.PLANT) - 2);
  }
}
