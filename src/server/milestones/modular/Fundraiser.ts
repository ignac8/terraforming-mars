import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {IMarsBot} from '../../automa/MarsBotCorpTypes';
import {BoardName} from '../../../common/boards/BoardName';
import {marsBotTrackPosition, marsBotUsesMapSet} from '../../automa/MarsBotMilestoneAwardEval';

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
   * MarsBot's M€ track is its Event track. Terra Cimmeria, where this milestone is called
   * Financier, asks for space 10. The Milestones & Awards expansion asks for space 8.
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    const threshold = marsBotUsesMapSet(bot, BoardName.TERRA_CIMMERIA_NOVA) ? 10 : 8;
    return marsBotTrackPosition(bot, Tag.EVENT) >= threshold;
  }
}
