import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Smith extends BaseMilestone {
  constructor() {
    super(
      'Smith',
      'Have a total of 6 steel and titanium production',
      6);
  }

  public getScore(player: IPlayer): number {
    return player.production.steel + player.production.titanium;
  }

  /**
   * Requires the Building and Space tracks to add up to 7 (rulebook C, p.10, where this milestone
   * is called Metallurgist).
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return marsBotTrackPosition(bot, Tag.BUILDING) + marsBotTrackPosition(bot, Tag.SPACE) >= 7;
  }
}
