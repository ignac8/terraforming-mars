import {BonusCardId} from '@/common/automa/AutomaTypes';
import {marsBotMapRules} from '@/common/automa/MarsBotMapRules';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B04: Overachievement
export const OVERACHIEVEMENT_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B04_OVERACHIEVEMENT,
  resolve(resolver) {
    // Claim a milestone; failing that, fund an award once the map's generation threshold for it is reached
    const {generationShift} = marsBotMapRules(resolver.game.gameOptions.boardName);
    const done = resolver.turnResolver.maybeClaimMilestone() ||
      (resolver.game.generation >= 6 + generationShift && resolver.turnResolver.maybeFundAward());
    if (done) {
      resolver.game.log('Overachievement is destroyed');
      return true;
    }
    resolver.turnResolver.gainMc(5);
    resolver.game.log('MarsBot gains 5 MC (Overachievement failed)');
    return false;
  },
};
