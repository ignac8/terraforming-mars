import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {BoardName} from '@/common/boards/BoardName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition, marsBotUsesMapSet} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Farmer extends BaseMilestone {
  constructor() {
    super(
      'Farmer',
      'Have 5 animal and microbe resources on your cards',
      5);
  }
  public getScore(player: IPlayer): number {
    return player.getResourceCount(CardResource.MICROBE) + player.getResourceCount(CardResource.ANIMAL);
  }

  /**
   * Requires space 6 of the Microbe track or of the Bio track on Vastitas Borealis (rulebook C,
   * p.10), and space 7 of the Bio track with the Milestones & Awards expansion (rulebook C, p.13).
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    if (marsBotUsesMapSet(bot, BoardName.VASTITAS_BOREALIS_NOVA)) {
      return marsBotTrackPosition(bot, Tag.MICROBE) >= 6 || marsBotTrackPosition(bot, Tag.PLANT) >= 6;
    }
    return marsBotTrackPosition(bot, Tag.PLANT) >= 7;
  }
}
