import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

// B05: Expedited Construction
export class ExpeditedConstructionMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B05_EXPEDITED_CONSTRUCTION});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    const space = resolver.tilePlacer.findExpeditedConstructionCitySpace();
    if (space !== undefined) {
      resolver.game.addCity(resolver.botPlayer, space);
      resolver.turnResolver.gainMc(resolver.tilePlacer.getTotalPlacementMC(space));
      resolver.game.log('MarsBot places city (Expedited Construction), card destroyed');
      return true;
    }
    // No failed action if can't place
    return false;
  }
}
