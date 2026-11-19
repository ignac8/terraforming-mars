import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

export const INVESTORS_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B32_INVESTORS,
  resolve(resolver) {
    // Utopia Invest: a. in an even generation, advance the least-advanced track and move the
    // most-advanced track back 1 space; b. otherwise gain 1 M€ per space of the least-advanced
    // track. Ties go to the upper track.
    const marsBotBoard = resolver.turnResolver.marsBotBoard;
    const leastIndex = marsBotBoard.getLeastAdvancedTrackIndex();
    if (resolver.game.generation % 2 === 0) {
      const mostIndex = marsBotBoard.getMostAdvancedTrackIndex();
      resolver.maybeAdvanceTrack(leastIndex);
      marsBotBoard.tracks[mostIndex].regress();
      resolver.game.log('MarsBot resolves Investors: advance least-advanced track, move most-advanced track back');
    } else {
      const amount = marsBotBoard.tracks[leastIndex].position;
      resolver.turnResolver.gainMc(amount);
      resolver.game.log('MarsBot resolves Investors: +${0} M€ (least-advanced track)', (b) => b.number(amount));
    }
    return false;
  },
};
