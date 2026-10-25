import {BaseMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {IMarsBot} from '@/server/automa/MarsBotCorpTypes';
import {marsBotAllTrackPositions} from '@/server/automa/MarsBotMilestoneAwardEval';

export class Diversifier extends BaseMilestone {
  constructor() {
    super(
      'Diversifier',
      'Have 8 different tags in play',
      8);
  }
  public getScore(player: IPlayer): number {
    return player.tags.distinctCount('milestone');
  }

  /**
   * Requires space 3 on 7 tracks, which is every track without Venus Next and all but one with it
   * (rulebook C, pp.2, 9, 13).
   */
  public marsBotCanClaim(bot: IMarsBot): boolean {
    return marsBotAllTrackPositions(bot).filter((position) => position >= 3).length >= 7;
  }
}
