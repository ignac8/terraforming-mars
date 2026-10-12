import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {isSpecialTileSpace, Board} from '../../boards/Board';
import {IMarsBot} from '../../automa/MarsBotCorpTypes';

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

  /** Utopia Planitia calls it Specialist. MarsBot places no special tiles, so it counts the bonus cards it destroyed. */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.destroyedBonusCards >= 3;
  }
}
