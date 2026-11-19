import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

// Arcadian Communities: a player marker, not a tile, on a space that is not reserved
export class SettlersMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B22_SETTLERS});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    const space = resolver.tilePlacer.findMarkerSpace();
    if (space === undefined || resolver.marsBotManager === undefined) {
      resolver.game.log('MarsBot resolves Settlers: no space left for a player marker');
      return false;
    }
    resolver.marsBotManager.placeMarker(space);
    return false;
  }
}
