import {GlobalParameter} from '@/common/GlobalParameter';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import * as constants from '@/common/constants';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

export const VENUSIAN_LOBBY_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B26_VENUSIAN_LOBBY,
  resolve(resolver) {
    if (resolver.game.gameOptions.venusNextExtension) {
      // Morningstar: raise Venus 1 step and advance the Venus track (index 7), then raise the
      // global parameter furthest from its maximum
      if (resolver.game.getVenusScaleLevel() < constants.MAX_VENUS_SCALE && !resolver.interceptsRaise(GlobalParameter.VENUS)) {
        resolver.game.increaseVenusScaleLevel(resolver.botPlayer, 1);
      }
      if (resolver.turnResolver.marsBotBoard.tracks.length > 7) {
        resolver.maybeAdvanceTrack(7);
      }
      resolver.game.log('MarsBot resolves Venusian Lobby: raise Venus, advance Venus track');
      resolver.advanceFurthestParameter();
    } else {
      // Without Venus, advance least-advanced track
      const leastIdx = resolver.turnResolver.marsBotBoard.getLeastAdvancedTrackIndex();
      resolver.maybeAdvanceTrack(leastIdx);
      resolver.game.log('MarsBot resolves Venusian Lobby: advance least-advanced track (no Venus)');
    }
    return false;
  },
};
