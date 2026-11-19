import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';

// Arcadian Communities: a player marker, not a tile, on a space that is not reserved
export class SettlersMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B22_SETTLERS});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    const space = new MarsBotTilePlacer(marsBot).findMarkerSpace();
    if (space === undefined) {
      marsBot.game.log('MarsBot resolves Settlers: no space left for a player marker');
      return false;
    }
    marsBot.placeMarker(space);
    return false;
  }
}
