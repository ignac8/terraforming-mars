import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {BoardName} from '@/common/boards/BoardName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition, marsBotUsesMapSet} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Fundraiser extends BaseMilestone {
  constructor() {
    super(
      'Fundraiser',
      'Have 12 M€ production',
      12);
  }
  public getScore(player: IPlayer): number {
    return player.production.megacredits;
  }

  /**
   * Requires space 10 of the Event track on Terra Cimmeria, where this milestone is called
   * Financier (rulebook C, p.9), and space 8 with the Milestones & Awards expansion
   * (rulebook C, p.13).
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    const threshold = marsBotUsesMapSet(bot, BoardName.TERRA_CIMMERIA_NOVA) ? 10 : 8;
    return marsBotTrackPosition(bot, Tag.EVENT) >= threshold;
  }
}
