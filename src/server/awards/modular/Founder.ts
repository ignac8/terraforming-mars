import {IAward} from '../IAward';
import {IPlayer} from '../../IPlayer';
import {Board, isSpecialTileSpace} from '../../boards/Board';
import {Space} from '@/server/boards/Space';
import {TileType} from '@/common/TileType';

export class Founder implements IAward {
  public readonly name = 'Founder';
  public readonly description = 'Have the most tiles adjacent to special tiles.';

  public getScore(player: IPlayer): number {
    // Only MarsBot counts its Neural Instance tile as special (rulebook C, p.9).
    return this.countNextToSpecialTiles(
      player, (space) => isSpecialTileSpace(space) && space.tile?.tileType !== TileType.NEURAL_INSTANCE);
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
