import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {CardType} from '../../../common/cards/CardType';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';


export class Sponsor extends BaseMilestone {
  constructor() {
    super(
      'Sponsor',
      'Have 3 cards that have cost of 20 M€ or more',
      3);
  }
  public getScore(player: IPlayer): number {
    return player.playedCards.projects()
      .filter((card) => (card.cost >= 20) && (card.type === CardType.ACTIVE || card.type === CardType.AUTOMATED)).length;
  }

  /**
   * Counts the cards costing 20 M€ or more in MarsBot's played pile, events included
   * (rulebook C, p.14).
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.playedProjectCards.filter((card) => card.cost >= 20).length >= 3;
  }
}
