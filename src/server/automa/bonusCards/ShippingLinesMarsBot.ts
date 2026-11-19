import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B19: Shipping Lines / B20: Extended Shipping Lines — C-17
export const SHIPPING_LINES_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B19_SHIPPING_LINES,
  resolve(resolver) {
    resolver.resolveTradeAction('Shipping Lines');
    return false;
  },
};
