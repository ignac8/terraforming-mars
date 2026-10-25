
import {IAward} from './IAward';
import {IPlayer} from '../IPlayer';
import {CardType} from '../../common/cards/CardType';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';

export class Magnate implements IAward {
  public readonly name = 'Magnate';
  public readonly description = 'Have the most automated (green) project cards in play';
  public getScore(player: IPlayer): number {
    return player.playedCards
      .filter((card) => card.type === CardType.AUTOMATED).length;
  }

  /**
   * Counts the green cards in MarsBot's played pile (rulebook C, p.9). The list on p.15 says "blue
   * and green", which the designer confirmed is a typo (BGG thread 3534424).
   */
  public marsBotScore(bot: IMarsBot): number {
    return bot.playedProjectCards.filter((card) => card.type === CardType.AUTOMATED).length;
  }
}
