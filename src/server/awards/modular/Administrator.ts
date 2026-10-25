import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';

export class Administrator implements IAward {
  public readonly name = 'Administrator';
  public readonly description = 'Have the most cards with no tags';

  public getScore(player: IPlayer): number {
    return player.tags.numberOfCardsWithNoTags();
  }

  /**
   * Counts the cards without tags in MarsBot's played pile, plus 2 (rulebook C, p.14). MarsBot's
   * resolved cards stay in that pile and never reach its player's tableau, which `getScore` reads.
   */
  public marsBotScore(bot: IMarsBot): number {
    return bot.playedProjectCards.filter((card) => card.tags.length === 0).length + 2;
  }
}
