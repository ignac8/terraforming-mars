import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {selectRandomColony, placeColonyForMarsBot} from '@/server/automa/colonies/MarsBotColonyPlacer';

// B17: Expedited Construction (Colonies) — C-15
export const EXPEDITED_CONSTRUCTION_COLONIES_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES,
  resolve(resolver) {
    // C-15a: Place city adjacent to ≥2 greenery/ocean tiles → destroy card
    const citySpace = resolver.tilePlacer.findExpeditedConstructionCitySpace();
    if (citySpace !== undefined) {
      resolver.game.addCity(resolver.botPlayer, citySpace);
      resolver.turnResolver.gainMc(resolver.tilePlacer.getTotalPlacementMC(citySpace));
      resolver.game.log('MarsBot places city (Expedited Construction Colonies), card destroyed (C-15a)');
      return true;
    }

    // C-15b: If MarsBot has ≤1 colonies, place on a random eligible tile — do NOT destroy
    const marsBot = resolver.marsBotManager;
    if (marsBot !== undefined) {
      const colonyCount = resolver.game.colonies.filter((c) => c.colonies.includes(resolver.botPlayer.id)).length;
      if (colonyCount <= 1) {
        const colony = selectRandomColony(resolver.game, marsBot);
        if (colony !== undefined) {
          placeColonyForMarsBot(colony, marsBot);
          resolver.game.log('MarsBot places colony (Expedited Construction Colonies, C-15b)');
          return false;
        }
      }
    }

    // C-15c: No effect
    resolver.game.log('MarsBot Expedited Construction Colonies: no effect (C-15c)');
    return false;
  },
};
