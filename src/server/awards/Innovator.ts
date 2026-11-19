import {IPlayer} from '@/server/IPlayer';
import {IAward} from '@/server/awards/IAward';
import {IMarsBot} from '@/server/automa/IMarsBot';

export class Innovator implements IAward {
  public readonly name = 'Innovator';
  public readonly description = 'Have played the most green, blue, and red cards (events included).';
  public readonly automaDescription = 'Played cards minus the generation';

  public getScore(player: IPlayer): number {
    // Project cards are exactly the green (automated), blue (active), and red (event) cards.
    // Events stay counted in playedCards, so this includes them.
    return player.playedCards.projects().length;
  }

  /**
   * Scores the cards in MarsBot's played pile minus the current generation.
   *
   * MarsBot plays more cards a generation than a human does, so subtracting the generation keeps
   * its pace of play from deciding the award on its own.
   */
  public marsBotScore(marsBot: IMarsBot): number {
    return marsBot.playedProjectCards.length - marsBot.game.generation;
  }
}
