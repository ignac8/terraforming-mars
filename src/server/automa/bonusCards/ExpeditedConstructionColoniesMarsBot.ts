import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';

// B17: Expedited Construction (Colonies) — C-15
export class ExpeditedConstructionColoniesMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    // C-15a: Place city adjacent to ≥2 greenery/ocean tiles → destroy card
    const tilePlacer = new MarsBotTilePlacer(marsBot);
    const citySpace = tilePlacer.findExpeditedConstructionCitySpace();
    if (citySpace !== undefined) {
      marsBot.game.addCity(marsBot.player, citySpace);
      marsBot.gainMc(tilePlacer.getTotalPlacementMC(citySpace));
      marsBot.game.log('MarsBot places city (Expedited Construction Colonies), card destroyed (C-15a)');
      return true;
    }

    // C-15b: If MarsBot has ≤1 colonies, place on a random eligible tile — do NOT destroy
    const colonyCount = marsBot.game.colonies.filter((c) => c.colonies.includes(marsBot.player.id)).length;
    if (colonyCount <= 1 && marsBot.maybePlaceRandomColony()) {
      marsBot.game.log('MarsBot places colony (Expedited Construction Colonies, C-15b)');
      return false;
    }

    // C-15c: No effect
    marsBot.game.log('MarsBot Expedited Construction Colonies: no effect (C-15c)');
    return false;
  }
}
