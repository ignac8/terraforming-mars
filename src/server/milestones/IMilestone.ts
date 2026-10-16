import {MilestoneName} from '../../common/ma/MilestoneName';
import {IPlayer} from '../IPlayer';
import {IMarsBot} from '../automa/MarsBotCorpTypes';

export interface IMilestone {
  name: MilestoneName;
  description: string;
  canClaim(player: IPlayer): boolean;
  getScore(player: IPlayer): number;
  /** How far the player is from claiming this: 0 when they qualify. Left out when it can't be counted. */
  remaining?(player: IPlayer): number;
  /**
   * Whether MarsBot qualifies, for the milestones where the automa rules differ from
   * canClaim with MarsBot's player. Most milestones don't need it.
   */
  marsBotCanClaim?(bot: IMarsBot): boolean;
}

export abstract class BaseMilestone implements IMilestone {
  public readonly name: MilestoneName;
  public readonly description: string;
  public readonly threshold: number;

  constructor(name: MilestoneName, description: string, threshold: number) {
    this.name = name;
    this.description = description;
    this.threshold = threshold;
  }

  public abstract getScore(player: IPlayer): number;
  public canClaim(player: IPlayer): boolean {
    return this.getScore(player) >= this.threshold;
  }
  public remaining(player: IPlayer): number {
    return Math.max(0, this.threshold - this.getScore(player));
  }
}
