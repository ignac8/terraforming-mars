import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusDeckCard, bonusCardDisplayName} from '@/server/automa/MarsBotBonusCard';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B18: Outer System Foothold — C-16
export class OuterSystemFootholdMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    // C-16a/b: Place colony on randomly selected eligible tile
    if (marsBot.maybePlaceRandomColony()) {
      marsBot.game.log('MarsBot places colony via Outer System Foothold (C-16a/b)');
    } else {
      marsBot.game.log('MarsBot Outer System Foothold: no eligible colony tile (C-16a)');
    }

    // C-16c/d: Draw from bonus deck (excluding B18 itself), discard without resolving
    // Temporarily remove B18 from discard so it isn't reshuffled back in
    const b18Idx = marsBot.bonusDeck.discardPile.findIndex((c) => c.id === BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
    let b18Card: MarsBotBonusDeckCard | undefined;
    if (b18Idx >= 0) {
      [b18Card] = marsBot.bonusDeck.discardPile.splice(b18Idx, 1);
    }
    const drawnBonus = marsBot.bonusDeck.draw(marsBot.game);
    if (b18Card !== undefined) {
      marsBot.bonusDeck.discardPile.push(b18Card); // Restore B18
    }
    if (drawnBonus !== undefined) {
      marsBot.bonusDeck.discard(drawnBonus);
      marsBot.game.log('MarsBot draws and discards ${0} (Outer System Foothold, C-16c)', (b) => b.rawString(bonusCardDisplayName(drawnBonus)));
    }

    // The card itself (B18) is discarded by the caller after resolve() returns.
    return false;
  }
}
