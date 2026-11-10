import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B04: Overachievement
export const OVERACHIEVEMENT_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B04_OVERACHIEVEMENT,
  resolve(resolver) {
    // Claim a milestone; failing that, from generation 6 on, fund an award
    const done = resolver.turnResolver.maybeClaimMilestone() ||
      (resolver.game.generation >= 6 && resolver.turnResolver.maybeFundAward());
    if (done) {
      resolver.game.log('Overachievement is destroyed');
      return true;
    }
    resolver.turnResolver.gainMc(5);
    resolver.game.log('MarsBot gains 5 MC (Overachievement failed)');
    return false;
  },
};
