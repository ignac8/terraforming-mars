import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B19: Shipping Lines / B20: Extended Shipping Lines — C-17
export class ShippingLinesMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B19_SHIPPING_LINES});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    marsBot.maybeTrade('Shipping Lines');
    return false;
  }
}
