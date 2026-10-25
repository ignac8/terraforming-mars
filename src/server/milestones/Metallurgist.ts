import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Metallurgist extends BaseMilestone {
  constructor() {
    super(
      'Metallurgist',
      'Have a total of 6 steel and titanium production',
      6);
  }

  public getScore(player: IPlayer): number {
    return player.production.steel + player.production.titanium;
  }

  /** Requires the Building and Space tracks to add up to 9 (rulebook C, p.13). */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return marsBotTrackPosition(bot, Tag.BUILDING) + marsBotTrackPosition(bot, Tag.SPACE) >= 9;
  }
}
