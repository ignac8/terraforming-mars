import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';
export class Manufacturer implements IAward {
  public readonly name = 'Manufacturer';
  public readonly description = 'Have the highest production of steel and heat combined.';

  public getScore(player: IPlayer): number {
    return player.production.steel + player.production.heat;
  }

  /** Scores the Building and Energy track spaces together (rulebook C, p.15). */
  public marsBotScore(bot: IMarsBot): number {
    return marsBotTrackPosition(bot, Tag.BUILDING) + marsBotTrackPosition(bot, Tag.POWER);
  }
}
