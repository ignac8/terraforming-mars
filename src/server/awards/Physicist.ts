import {IPlayer} from '@/server/IPlayer';
import {IAward} from '@/server/awards/IAward';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {Tag} from '@/common/cards/Tag';

export class Physicist implements IAward {
  public readonly name = 'Physicist';
  public readonly description = 'Have the most science and space tags in play, combined.';
  public readonly automaDescription = 'Science + Space tracks − 5';

  public getScore(player: IPlayer): number {
    return player.tags.multipleCount([Tag.SCIENCE, Tag.SPACE], 'award');
  }

  /** Scores MarsBot's Science and Space track spaces combined, minus 5. */
  public marsBotScore(marsBot: IMarsBot): number {
    return marsBot.marsBotBoard.trackPosition(Tag.SCIENCE) + marsBot.marsBotBoard.trackPosition(Tag.SPACE) - 5;
  }
}
