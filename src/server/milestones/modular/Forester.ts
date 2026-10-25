import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';
import {MilestoneName} from '../../../common/ma/MilestoneName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotTrackPosition} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Forester extends BaseMilestone {
  constructor(name: MilestoneName = 'Forester', threshold: number = 4) {
    super(name, `Have ${threshold} plant production`, threshold);
  }

  public getScore(player: IPlayer): number {
    return player.production.plants;
  }

  /** Requires space 6 of the Bio track (rulebook C, p.13). */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return marsBotTrackPosition(bot, Tag.PLANT) >= 6;
  }
}

// Forester variant from Terra Cimmeria Nova.
export class CForester extends Forester {
  constructor() {
    super('C. Forester', 3);
  }
}
