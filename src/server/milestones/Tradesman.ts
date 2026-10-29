import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {IMarsBot} from '../automa/MarsBotCorpTypes';

export class Tradesman extends BaseMilestone {
  constructor() {
    super(
      'Tradesman',
      'Have 3 different types of non-standard resources',
      3);
  }

  public getScore(player: IPlayer): number {
    const nonStandardResources = new Set(player.getCardsWithResources().map((card) => card.resourceType));
    if (player.underworldData.corruption > 0) {
      return nonStandardResources.size + 1;
    } else {
      return nonStandardResources.size;
    }
  }

  /** Utopia Planitia calls it Trader: MarsBot needs space 2 on its power, earth and Venus tracks. */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return [Tag.POWER, Tag.EARTH, Tag.VENUS].every((tag) => bot.marsBotBoard.trackPosition(tag) >= 2);
  }
}
