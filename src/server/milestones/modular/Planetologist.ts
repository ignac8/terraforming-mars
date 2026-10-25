import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {BoardName} from '@/common/boards/BoardName';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition, marsBotUsesMapSet} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Planetologist extends BaseMilestone {
  constructor() {
    super(
      'Planetologist',
      'Have 2 Earth tags, 2 Venus tags, and 2 Jovian tags',
      6,
    );
  }

  public getScore(player: IPlayer): number {
    const earthTags = Math.min(player.tags.count(Tag.EARTH, 'raw'), 2);
    const venusTags = Math.min(player.tags.count(Tag.VENUS, 'raw'), 2);
    const jovianTags = Math.min(player.tags.count(Tag.JOVIAN, 'raw'), 2);
    const wildTags = player.tags.count(Tag.WILD, 'milestone');
    return Math.min(earthTags + venusTags + jovianTags + wildTags, 6);
  }

  /**
   * Requires the Earth and Venus tracks to add up to 5 on Terra Cimmeria (rulebook C, p.9), and
   * space 3 on two of the Energy, Earth and Venus tracks with the Milestones & Awards expansion
   * (rulebook C, p.14).
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    if (marsBotUsesMapSet(bot, BoardName.TERRA_CIMMERIA_NOVA)) {
      return marsBotTrackPosition(bot, Tag.EARTH) + marsBotTrackPosition(bot, Tag.VENUS) >= 5;
    }
    const positions = [Tag.POWER, Tag.EARTH, Tag.VENUS].map((tag) => marsBotTrackPosition(bot, tag));
    return positions.filter((position) => position >= 3).length >= 2;
  }
}
