import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {isSpecialTileSpace, Board} from '../../boards/Board';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';

export class LandSpecialist extends BaseMilestone {
  constructor() {
    super(
      'Land Specialist',
      'Own 3 special (normally, brown) tiles',
      3);
  }
  public getScore(player: IPlayer): number {
    const marsSpaces = player.game.board.spaces;
    const marsCount = marsSpaces.filter(Board.ownedBy(player))
      .filter(isSpecialTileSpace).length;

    const moonSpaces = player.game.moonData?.moon.spaces ?? [];
    const moonCount = moonSpaces
      .filter(Board.ownedBy(player))
      .filter(isSpecialTileSpace)
      .length;

    return marsCount + moonCount;
  }

  /**
   * Counts the bonus cards MarsBot destroyed, since it places no special tiles (rulebook C, p.10,
   * where this milestone is called Specialist).
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.destroyedBonusCards >= 3;
  }
}
