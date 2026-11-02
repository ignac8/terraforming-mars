import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {Board} from '../boards/Board';
import {MilestoneName} from '../../common/ma/MilestoneName';
import {BoardName} from '../../common/boards/BoardName';
import {IMarsBot} from '../automa/IMarsBot';
import {marsBotUsesMapSet} from '../automa/MarsBotMilestoneAwardEval';

export class Irrigator extends BaseMilestone {
  constructor(
    name: MilestoneName = 'Irrigator',
    threshold: number = 4) {
    super(name, `Own ${threshold} tiles adjacent to oceans`, threshold);
  }

  public getScore(player: IPlayer): number {
    return player.game.board.spaces.filter((space) =>
      space.player === player &&
     Board.hasRealTile(space) &&
      player.game.board.getAdjacentSpaces(space).some((space) => Board.isOceanSpace(space)),
    ).length;
  }
}

// Variant from Terra Cimmeria Nova.
export class Coastguard extends Irrigator {
  public readonly automaDescription = '4+ tiles adjacent to ocean';
  public readonly automaMapDescriptions = {
    [BoardName.TERRA_CIMMERIA_NOVA]: '3+ tiles adjacent to ocean',
  };
  constructor() {
    super('Coastguard', 3);
  }

  /**
   * Terra Cimmeria leaves this milestone unchanged for MarsBot. The Milestones & Awards
   * expansion puts its threshold at 4 tiles adjacent to oceans.
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    if (marsBotUsesMapSet(bot, BoardName.TERRA_CIMMERIA_NOVA)) {
      return this.canClaim(bot.player);
    }
    return this.getScore(bot.player) >= 4;
  }
}
