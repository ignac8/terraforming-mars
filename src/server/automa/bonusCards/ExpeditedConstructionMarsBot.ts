import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B05: Expedited Construction
export const EXPEDITED_CONSTRUCTION_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B05_EXPEDITED_CONSTRUCTION,
  resolve(resolver) {
    const space = resolver.tilePlacer.findExpeditedConstructionCitySpace();
    if (space !== undefined) {
      resolver.game.addCity(resolver.botPlayer, space);
      resolver.turnResolver.gainMc(resolver.tilePlacer.getTotalPlacementMC(space));
      resolver.game.log('MarsBot places city (Expedited Construction), card destroyed');
      return true;
    }
    // No failed action if can't place
    return false;
  },
};
