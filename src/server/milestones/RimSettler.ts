import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {BoardName} from '@/common/boards/BoardName';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition, marsBotUsesMapSet} from '@/server/automa/MarsBotMilestoneAwardEval';

export class RimSettler extends BaseMilestone {
  constructor() {
    super(
      'Rim Settler',
      'Have 3 Jovian tags in play',
      3);
  }
  public getScore(player: IPlayer): number {
    return player.tags.count(Tag.JOVIAN, 'milestone');
  }

  /**
   * Requires space 6 of the Jovian track on Hellas (rulebook C, p.9) and space 5 of the Energy
   * track with the Milestones & Awards expansion (rulebook C, p.14).
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    if (marsBotUsesMapSet(bot, BoardName.HELLAS)) {
      return marsBotTrackPosition(bot, Tag.JOVIAN) >= 6;
    }
    return marsBotTrackPosition(bot, Tag.POWER) >= 5;
  }
}
