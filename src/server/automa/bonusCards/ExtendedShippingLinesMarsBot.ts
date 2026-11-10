import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

export const EXTENDED_SHIPPING_LINES_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B20_EXTENDED_SHIPPING_LINES,
  resolve(resolver) {
    resolver.resolveTradeAction('Extended Shipping Lines');
    return false;
  },
};
