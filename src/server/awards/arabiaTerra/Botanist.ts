import {IAward} from '../IAward';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {IMarsBot} from '../../automa/IMarsBot';

export class Botanist implements IAward {
  public readonly name = 'Botanist';
  public readonly description = 'Have the most plant production';
  public readonly automaDescription = 'Bio track - 2';
  public getScore(player: IPlayer): number {
    return player.production.plants;
  }

  /** The automa rules score MarsBot's Botanist as its bio track minus 2, which can be below 0. */
  public marsBotScore(bot: IMarsBot): number {
    return bot.marsBotBoard.trackPosition(Tag.PLANT) - 2;
  }
}
