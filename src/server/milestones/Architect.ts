import {TagBasedMilestone} from './TagBasedMilestone';
import {Tag} from '../../common/cards/Tag';
import {IMarsBot} from '../automa/MarsBotCorpTypes';

export class Architect extends TagBasedMilestone {
  constructor() {
    super('Architect', 'Have 3 city tags in play', 3, [Tag.CITY]);
  }

  /** The automa rules put MarsBot's threshold at space 6 of its city-tag track. */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.marsBotBoard.trackPosition(Tag.CITY) >= 6;
  }
}
