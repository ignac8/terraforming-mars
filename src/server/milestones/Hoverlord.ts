import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {CardResource} from '../../common/CardResource';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';

export class Hoverlord extends BaseMilestone {
  constructor() {
    super(
      'Hoverlord',
      'Have 7 floater resources on your cards',
      7);
  }
  public getScore(player: IPlayer): number {
    let floaterResources = 0;
    player.getCardsWithResources(CardResource.FLOATER).forEach((card) => {
      floaterResources += card.resourceCount;
    });
    return floaterResources;
  }

  /**
   * Counts the floaters on MarsBot's Venus board, which holds them in place of cards
   * (rulebook C, p.2).
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.floaters >= 7;
  }
}
