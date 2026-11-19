import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {maybePlaceGreenery} from '@/server/automa/bonusCards/bonusCardHelpers';

// Ecoline: a. spend the plant on the corp card to place a greenery; b. otherwise put a plant there.
// With no greenery space the plant is spent anyway, and a bonus card that can't resolve is not a Failed Action.
export class RapidSproutingMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B23_RAPID_SPROUTING});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    if (marsBot.getCorpState('plantResources') > 0) {
      marsBot.setCorpState('plantResources', 0);
      if (maybePlaceGreenery(marsBot)) {
        marsBot.game.log('MarsBot resolves Rapid Sprouting: placed greenery');
      } else {
        marsBot.game.log('MarsBot resolves Rapid Sprouting: no greenery space, plant spent');
      }
    } else {
      marsBot.setCorpState('plantResources', 1);
      marsBot.game.log('MarsBot resolves Rapid Sprouting: 1 plant on the corporation card');
    }
    return false;
  }
}
