import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';
import {ALL_RESOURCES} from '../../../common/Resource';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotAllTrackPositions} from '@/server/automa/MarsBotMilestoneAwardEval';


export class Collector implements IAward {
  public readonly name = 'Collector';
  public readonly description = 'Have the most different types of resources, both on your player board and on your cards.';

  public getScore(player: IPlayer): number {
    const standardResources = ALL_RESOURCES.filter((res) => player.stock.get(res) > 0).length;
    const nonStandardResources = new Set(player.getCardsWithResources().map((card) => card.resourceType)).size;
    return standardResources + nonStandardResources;
  }

  /** Counts the tracks that reached space 3 (rulebook C, p.14). */
  public marsBotScore(bot: IMarsBot): number {
    return marsBotAllTrackPositions(bot).filter((position) => position >= 3).length;
  }
}
