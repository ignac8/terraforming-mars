import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {IMarsBot} from '../../automa/MarsBotCorpTypes';
import {BoardName} from '../../../common/boards/BoardName';
import {marsBotUsesMapSet} from '../../automa/MarsBotMilestoneAwardEval';

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
   * On Terra Cimmeria MarsBot qualifies with its Earth and Venus tracks adding up to 5. The
   * Milestones & Awards expansion asks for two of its power, earth and Venus tracks at space 3.
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    if (marsBotUsesMapSet(bot, BoardName.TERRA_CIMMERIA_NOVA)) {
      return bot.marsBotBoard.trackPosition(Tag.EARTH) + bot.marsBotBoard.trackPosition(Tag.VENUS) >= 5;
    }
    const positions = [Tag.POWER, Tag.EARTH, Tag.VENUS].map((tag) => bot.marsBotBoard.trackPosition(tag));
    return positions.filter((position) => position >= 3).length >= 2;
  }
}
