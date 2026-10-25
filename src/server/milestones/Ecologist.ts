import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Ecologist extends BaseMilestone {
  constructor() {
    super(
      'Ecologist',
      'Have 4 bio tags in play (plant, microbe and animal tags count as bio tags)',
      4);
  }
  public getScore(player: IPlayer): number {
    return player.tags.multipleCount([Tag.PLANT, Tag.ANIMAL, Tag.MICROBE], 'milestone');
  }

  /**
   * Requires space 4 of the Bio track (rulebook C, pp.9, 13). The ordinary rule would count that
   * one track once for each of its tags.
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return marsBotTrackPosition(bot, Tag.PLANT) >= 4;
  }
}
