import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

// B19: Shipping Lines / B20: Extended Shipping Lines — C-17
export class ShippingLinesMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B19_SHIPPING_LINES});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    resolver.resolveTradeAction('Shipping Lines');
    return false;
  }
}
