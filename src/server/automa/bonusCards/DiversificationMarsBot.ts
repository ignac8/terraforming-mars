import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

export const DIVERSIFICATION_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B28_DIVERSIFICATION,
  resolve(resolver) {
    // Robinson Industries: advance least-advanced track, then lose up to 4 M€
    const marsBotBoard = resolver.turnResolver.marsBotBoard;
    const leastIndex = marsBotBoard.getLeastAdvancedTrackIndex();
    resolver.maybeAdvanceTrack(leastIndex);
    const lost = Math.min(4, resolver.turnResolver.megacredits);
    resolver.turnResolver.megacredits -= lost;
    resolver.game.log('MarsBot resolves Diversification: advance least-advanced track, lose ${0} M€', (b) => b.number(lost));
    return false;
  },
};
