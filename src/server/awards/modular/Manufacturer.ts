import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {BoardName} from '@/common/boards/BoardName';
import {marsBotUsesBoardGoals} from '@/server/automa/MarsBotMilestoneAwardEval';
export class Manufacturer implements IAward {
  public readonly name = 'Manufacturer';
  public readonly description = 'Have the highest production of steel and heat combined.';
  public readonly automaDescription = 'Building + Energy track';
  public readonly automaMapDescriptions = {
    [BoardName.AMAZONIS_PLANITIA]: 'Building + Energy tracks − 3',
  };

  public getScore(player: IPlayer): number {
    return player.production.steel + player.production.heat;
  }

  /**
   * Scores MarsBot's Building and Energy track spaces combined (rulebook C p.15).
   *
   * Amazonis Planitia plays its own rule, the same sum minus 3.
   */
  public marsBotScore(marsBot: IMarsBot): number {
    const score = marsBot.marsBotBoard.trackPosition(Tag.BUILDING) + marsBot.marsBotBoard.trackPosition(Tag.POWER);
    return marsBotUsesBoardGoals(marsBot, BoardName.AMAZONIS_PLANITIA) ? score - 3 : score;
  }
}
