import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

export const GOVERNMENT_SUBSIDY_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B31_GOVERNMENT_SUBSIDY,
  resolve(resolver) {
    // UNMI: raise TR 1 step
    resolver.botPlayer.increaseTerraformRating(1);
    resolver.game.log('MarsBot resolves Government Subsidy: +1 TR');
    return false;
  },
};
