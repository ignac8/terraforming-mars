import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {IMarsBot} from '../automa/MarsBotCorpTypes';

export class Smith extends BaseMilestone {
  constructor() {
    super(
      'Smith',
      'Have a total of 6 steel and titanium production',
      6);
  }

  public getScore(player: IPlayer): number {
    return player.production.steel + player.production.titanium;
  }

  /** Utopia Planitia calls it Metallurgist: MarsBot needs 7 across its building and space tracks. */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.marsBotBoard.trackPosition(Tag.BUILDING) + bot.marsBotBoard.trackPosition(Tag.SPACE) >= 7;
  }
}
