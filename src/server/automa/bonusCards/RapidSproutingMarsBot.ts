import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// Ecoline: a. spend the plant on the corp card to place a greenery; b. otherwise put a plant there.
// With no greenery space the plant is spent anyway, and a bonus card that can't resolve is not a Failed Action.
export const RAPID_SPROUTING_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B23_RAPID_SPROUTING,
  resolve(resolver) {
    const marsBot = resolver.marsBotManager;
    if (marsBot === undefined) {
      return false;
    }
    if (marsBot.getCorpState('plantResources') > 0) {
      marsBot.setCorpState('plantResources', 0);
      if (resolver.maybePlaceGreenery()) {
        resolver.game.log('MarsBot resolves Rapid Sprouting: placed greenery');
      } else {
        resolver.game.log('MarsBot resolves Rapid Sprouting: no greenery space, plant spent');
      }
    } else {
      marsBot.setCorpState('plantResources', 1);
      resolver.game.log('MarsBot resolves Rapid Sprouting: 1 plant on the corporation card');
    }
    return false;
  },
};
