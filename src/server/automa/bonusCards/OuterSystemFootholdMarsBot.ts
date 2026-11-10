import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusDeckCard, bonusCardDisplayName} from '@/server/automa/MarsBotBonusCard';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {selectRandomColony, placeColonyForMarsBot} from '@/server/automa/colonies/MarsBotColonyPlacer';

// B18: Outer System Foothold — C-16
export const OUTER_SYSTEM_FOOTHOLD_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD,
  resolve(resolver) {
    const marsBot = resolver.marsBotManager;
    if (marsBot === undefined) {
      resolver.game.log('MarsBot Outer System Foothold: no MarsBot manager available');
      return false;
    }

    // C-16a/b: Place colony on randomly selected eligible tile
    const colony = selectRandomColony(resolver.game, marsBot);
    if (colony !== undefined) {
      placeColonyForMarsBot(colony, marsBot);
      resolver.game.log('MarsBot places colony via Outer System Foothold (C-16a/b)');
    } else {
      resolver.game.log('MarsBot Outer System Foothold: no eligible colony tile (C-16a)');
    }

    // C-16c/d: Draw from bonus deck (excluding B18 itself), discard without resolving
    // Temporarily remove B18 from discard so it isn't reshuffled back in
    const b18Idx = resolver.bonusDeck.discardPile.findIndex((c) => c.id === BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
    let b18Card: MarsBotBonusDeckCard | undefined;
    if (b18Idx >= 0) {
      [b18Card] = resolver.bonusDeck.discardPile.splice(b18Idx, 1);
    }
    const drawnBonus = resolver.bonusDeck.draw(resolver.game);
    if (b18Card !== undefined) {
      resolver.bonusDeck.discardPile.push(b18Card); // Restore B18
    }
    if (drawnBonus !== undefined) {
      resolver.bonusDeck.discard(drawnBonus);
      resolver.game.log('MarsBot draws and discards ${0} (Outer System Foothold, C-16c)', (b) => b.rawString(bonusCardDisplayName(drawnBonus)));
    }

    // The card itself (B18) is discarded by the caller after resolve() returns.
    return false;
  },
};
