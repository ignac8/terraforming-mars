import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Engineer extends BaseMilestone {
  constructor() {
    super(
      'Engineer',
      'Have a total of 10 energy and heat production',
      10);
  }

  public getScore(player: IPlayer): number {
    return player.production.energy + player.production.heat;
  }

  /** Requires the Energy and Earth tracks to add up to 10 (rulebook C, pp.10, 13). */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return marsBotTrackPosition(bot, Tag.POWER) + marsBotTrackPosition(bot, Tag.EARTH) >= 10;
  }
}
