import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B06: Lobbyists / B15: Lobbyists (Venus) — shared (a) temp and (b) oxygen branches
export const LOBBYISTS_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B06_LOBBYISTS,
  resolve(resolver) {
    if (resolver.lobbyistsTempBranch()) {
      return true;
    }
    if (resolver.lobbyistsOxygenBranch()) {
      return true;
    }

    // (c) B06: Ocean adjacent to 2+ oceans
    if (resolver.lobbyistsOceanBranch()) {
      return true;
    }

    resolver.advanceFurthestParameter();
    return false;
  },
};
