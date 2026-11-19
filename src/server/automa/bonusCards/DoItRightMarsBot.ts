import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// Inventrix: the first of Lobbyists' temperature, oxygen and ocean branches that applies
export const DO_IT_RIGHT_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B25_DO_IT_RIGHT,
  resolve(resolver) {
    if (resolver.lobbyistsTempBranch('Do It Right') ||
      resolver.lobbyistsOxygenBranch('Do It Right') ||
      resolver.lobbyistsOceanBranch('Do It Right')) {
      return false;
    }
    resolver.game.log('MarsBot resolves Do It Right: no effect');
    return false;
  },
};
