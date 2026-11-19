import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';

// B05: Expedited Construction
export class ExpeditedConstructionMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B05_EXPEDITED_CONSTRUCTION});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    const tilePlacer = new MarsBotTilePlacer(marsBot);
    const space = tilePlacer.findExpeditedConstructionCitySpace();
    if (space !== undefined) {
      marsBot.game.addCity(marsBot.player, space);
      marsBot.gainMc(tilePlacer.getTotalPlacementMC(space));
      marsBot.game.log('MarsBot places city (Expedited Construction), card destroyed');
      return true;
    }
    // No failed action if can't place
    return false;
  }
}
