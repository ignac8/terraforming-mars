import {TagBasedMilestone} from './TagBasedMilestone';
import {Tag} from '../../common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Architect extends TagBasedMilestone {
  constructor() {
    super('Architect', 'Have 3 city tags in play', 3, [Tag.CITY]);
  }

  /** Requires space 6 of the City track (rulebook C, p.9). */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return marsBotTrackPosition(bot, Tag.CITY) >= 6;
  }
}
