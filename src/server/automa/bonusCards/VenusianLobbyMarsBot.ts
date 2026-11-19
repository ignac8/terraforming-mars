import {GlobalParameter} from '@/common/GlobalParameter';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {advanceFurthestParameter, maybeAdvanceTrack} from '@/server/automa/bonusCards/bonusCardHelpers';

export class VenusianLobbyMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B26_VENUSIAN_LOBBY});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    if (marsBot.game.gameOptions.venusNextExtension) {
      // Morningstar: raise Venus 1 step and advance the Venus track (index 7), then raise the
      // global parameter furthest from its maximum
      if (marsBot.game.getVenusScaleLevel() < marsBot.game.max.venus && !marsBot.interceptsParameterRaise(GlobalParameter.VENUS)) {
        marsBot.game.increaseVenusScaleLevel(marsBot.player, 1);
      }
      if (marsBot.marsBotBoard.tracks.length > 7) {
        maybeAdvanceTrack(marsBot, 7);
      }
      marsBot.game.log('MarsBot resolves Venusian Lobby: raise Venus, advance Venus track');
      advanceFurthestParameter(marsBot);
    } else {
      // Without Venus, advance least-advanced track
      const leastIdx = marsBot.marsBotBoard.getLeastAdvancedTrackIndex();
      maybeAdvanceTrack(marsBot, leastIdx);
      marsBot.game.log('MarsBot resolves Venusian Lobby: advance least-advanced track (no Venus)');
    }
    return false;
  }
}
