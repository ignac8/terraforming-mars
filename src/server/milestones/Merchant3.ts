import {IMilestone} from '@/server/milestones/IMilestone';
import {IPlayer} from '@/server/IPlayer';
import {Units} from '@/common/Units';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {Tag} from '@/common/cards/Tag';

const THREE_OF_EACH: Units = Units.every(3);

export class Merchant3 implements IMilestone {
  public readonly name = 'Merchant3';
  public readonly description = '3 of each standard resource (after paying the claim cost)';
  public readonly automaDescription = 'All tracks ≥ 3 (except Venus)';

  public getScore(player: IPlayer): number {
    if (this.canClaim(player)) {
      return 1;
    }
    return 0;
  }

  public canClaim(player: IPlayer): boolean {
    return player.canAfford({cost: player.milestoneCost(), reserveUnits: THREE_OF_EACH});
  }

  /** MarsBot needs space 3 on every track except Venus, one space more than Merchant asks. */
  public marsBotCanClaim(marsBot: IMarsBot): boolean {
    return marsBot.marsBotBoard.tracks
      .filter((track) => !track.definition.tags.includes(Tag.VENUS))
      .every((track) => track.position >= 3);
  }
}
