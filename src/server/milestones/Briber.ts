import {IMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';

export class Briber implements IMilestone {
  public readonly name = 'Briber';
  public readonly description = 'Pay 12 M€ to receive this milestone, in addition to the normal claim cost';
  public getScore(player: IPlayer): number {
    return player.spendableMegacredits();
  }
  public canClaim(player: IPlayer): boolean {
    return player.canAfford(player.milestoneCost() + 12);
  }

  /** Requires 20 M€, 12 of which claiming costs (rulebook C, p.13). */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return bot.megacredits >= 20;
  }
}
