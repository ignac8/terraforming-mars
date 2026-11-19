import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

export class ExtendedShippingLinesMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B20_EXTENDED_SHIPPING_LINES});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    resolver.resolveTradeAction('Extended Shipping Lines');
    return false;
  }
}
