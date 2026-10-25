import {IAward} from './IAward';
import {IPlayer} from '../IPlayer';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotAllTrackPositions} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Visionary implements IAward {
  public readonly name = 'Visionary';
  public readonly description = 'Have the most cards in hand';

  public getScore(player: IPlayer): number {
    return player.cardsInHand.length;
  }

  /**
   * Scores the lowest track space doubled, or the second lowest with Venus Next
   * (rulebook C, p.15).
   */
  public marsBotScore(bot: IMarsBot): number {
    const positions = marsBotAllTrackPositions(bot).sort((a, b) => a - b);
    const index = bot.game.gameOptions.venusNextExtension ? 1 : 0;
    return positions[index] * 2;
  }
}
