import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {IAward} from '../IAward';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class AZoologist implements IAward {
  public readonly name = 'A. Zoologist';
  public readonly description = 'Own the most animal and microbe resources';

  public getScore(player: IPlayer): number {
    const resourceTypes = [CardResource.ANIMAL, CardResource.MICROBE];
    let score = 0;

    player.getCardsWithResources().filter((card) => card.resourceType !== undefined && resourceTypes.includes(card.resourceType)).forEach((card) => {
      score += card.resourceCount;
    });

    return score;
  }

  /** Scores the Bio track space plus 5 (rulebook C, p.9). */
  public marsBotScore(bot: IMarsBot): number {
    return marsBotTrackPosition(bot, Tag.ANIMAL) + 5;
  }
}
