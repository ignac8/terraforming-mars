import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {CardType} from '@/common/cards/CardType';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';

export class Legend extends BaseMilestone {
  constructor() {
    super(
      'Legend',
      'Have 5 cards in your event pile',
      5);
  }
  public getScore(player: IPlayer): number {
    return player.getPlayedEventsCount();
  }

  /** Counts the events in MarsBot's played pile (rulebook C, p.9). */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.playedProjectCards.filter((card) => card.type === CardType.EVENT).length >= 5;
  }
}
