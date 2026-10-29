import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {IMarsBot} from '../../automa/MarsBotCorpTypes';

export class Engineer extends BaseMilestone {
  constructor() {
    super(
      'Engineer',
      'Have a total of 10 energy and heat production',
      10);
  }

  public getScore(player: IPlayer): number {
    return player.production.energy + player.production.heat;
  }

  /** MarsBot needs its power and earth tracks to add up to 10. Vastitas Borealis words it the same way. */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.marsBotBoard.trackPosition(Tag.POWER) + bot.marsBotBoard.trackPosition(Tag.EARTH) >= 10;
  }
}
