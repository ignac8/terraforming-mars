import {IAward} from '../IAward';
import {IPlayer} from '../../IPlayer';
import {Board, isSpecialTileSpace} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {TileType} from '../../../common/TileType';
import {IMarsBot} from '../../automa/MarsBotCorpTypes';

export class Founder implements IAward {
  public readonly name = 'Founder';
  public readonly description = 'Have the most tiles adjacent to special tiles.';

  public getScore(player: IPlayer): number {
    // The Neural Instance tile is MarsBot's. It is not a special tile for anyone else.
    return this.countNextToSpecialTiles(
      player, (space) => isSpecialTileSpace(space) && space.tile?.tileType !== TileType.NEURAL_INSTANCE);
  }

  /** The automa rules count the Neural Instance tile as a special tile for MarsBot. */
  public marsBotScore(bot: IMarsBot): number {
    return this.countNextToSpecialTiles(bot.player, isSpecialTileSpace);
  }

  private countNextToSpecialTiles(player: IPlayer, isSpecial: (space: Space) => boolean): number {
    const board = player.game.board;
    const specialTiles = board.spaces.filter(isSpecial);
    const adjacentToSpecialSpaces = new Set(specialTiles.map((s) => board.getAdjacentSpaces(s)).flat());

    const count = board.spaces.filter(Board.ownedBy(player))
      .filter((space) => space.tile !== undefined)
      .filter((space) => adjacentToSpecialSpaces.has(space))
      .length;
    return count;
  }
}
