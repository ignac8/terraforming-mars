import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {CardType} from '../../../common/cards/CardType';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';

export class Tycoon10 extends BaseMilestone {
  constructor() {
    super(
      'Tycoon10',
      'Have 10 blue and green cards in play.',
      10);
  }
  public getScore(player: IPlayer): number {
    return player.playedCards
      .filter((card) => card.type === CardType.ACTIVE || card.type === CardType.AUTOMATED).length;
  }

  /** Counts the green and blue cards in MarsBot's played pile (rulebook C, p.14). */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.playedProjectCards.filter((card) => card.type !== CardType.EVENT).length >= 10;
  }
}
