import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotAllTrackPositions} from '@/server/automa/MarsBotMilestoneAwardEval';
export class Mogul implements IAward {
  public readonly name = 'Mogul';
  public readonly description = 'Have the highest production (excluding M€) combined';

  public getScore(player: IPlayer): number {
    return player.production.steel + player.production.titanium + player.production.plants + player.production.energy + player.production.heat;
  }

  /** Scores the most advanced track space doubled (rulebook C, pp.9, 15). */
  public marsBotScore(bot: IMarsBot): number {
    return Math.max(...marsBotAllTrackPositions(bot)) * 2;
  }
}
