import {IAward} from './IAward';
import {IPlayer} from '../IPlayer';
import {CardType} from '../../common/cards/CardType';
import {CardName} from '../../common/cards/CardName';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';

export class Forecaster implements IAward {
  public readonly name = 'Forecaster';
  public readonly description = 'Have the most cards with requirements in play';

  public getScore(player: IPlayer): number {
    const validCards = player.playedCards.filter((card) => card.requirements.length > 0);

    if (player.playedCards.has(CardName.ODYSSEY)) {
      return validCards.length;
    }
    return validCards.filter((card) => card.type !== CardType.EVENT).length;
  }

  /** Counts every 7 M€ as one card with requirements (rulebook C, pp.9, 14). */
  public marsBotScore(bot: IMarsBot): number {
    return Math.floor(bot.megacredits / 7);
  }
}
