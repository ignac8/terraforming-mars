import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// Arcadian Communities: a player marker, not a tile, on a space that is not reserved
export const SETTLERS_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B22_SETTLERS,
  resolve(resolver) {
    const space = resolver.tilePlacer.findMarkerSpace();
    if (space === undefined || resolver.marsBotManager === undefined) {
      resolver.game.log('MarsBot resolves Settlers: no space left for a player marker');
      return false;
    }
    resolver.marsBotManager.placeMarker(space);
    return false;
  },
};
