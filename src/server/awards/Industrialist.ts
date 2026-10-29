import {IAward} from './IAward';
import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {IMarsBot} from '../automa/MarsBotCorpTypes';

export class Industrialist implements IAward {
  public readonly name = 'Industrialist';
  public readonly description = 'Have most steel and energy';
  public getScore(player: IPlayer): number {
    if (player.game.isDoneWithFinalProduction()) {
      return player.steel + player.energy;
    } else {
      return player.steel + player.production.steel + player.production.energy;
    }
  }

  /** The automa rules score MarsBot's Industrialist as its power track plus 5. */
  public marsBotScore(bot: IMarsBot): number {
    return bot.marsBotBoard.trackPosition(Tag.POWER) + 5;
  }
}
