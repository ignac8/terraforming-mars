import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {IMarsBot} from '../automa/MarsBotCorpTypes';
import {BoardName} from '../../common/boards/BoardName';
import {marsBotTrackPosition, marsBotUsesMapSet} from '../automa/MarsBotMilestoneAwardEval';

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
   * On Hellas MarsBot needs space 6 of its Jovian track, which it shares with Science. The
   * Milestones & Awards expansion asks for space 5 of the Energy track.
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    if (marsBotUsesMapSet(bot, BoardName.HELLAS)) {
      return marsBotTrackPosition(bot, Tag.JOVIAN) >= 6;
    }
    return marsBotTrackPosition(bot, Tag.POWER) >= 5;
  }
}
