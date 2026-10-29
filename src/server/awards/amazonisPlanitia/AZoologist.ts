import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {IAward} from '../IAward';
import {Tag} from '../../../common/cards/Tag';
import {IMarsBot} from '../../automa/MarsBotCorpTypes';

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

  /** The automa rules score MarsBot's Zoologist as its bio track plus 5. */
  public marsBotScore(bot: IMarsBot): number {
    return bot.marsBotBoard.trackPosition(Tag.ANIMAL) + 5;
  }
}
