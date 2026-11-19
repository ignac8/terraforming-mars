import {GlobalParameter} from '@/common/GlobalParameter';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

export const LOBBYISTS_VENUS_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B15_LOBBYISTS_VENUS,
  resolve(resolver) {
    if (resolver.lobbyistsTempBranch()) {
      return true;
    }
    if (resolver.lobbyistsOxygenBranch()) {
      return true;
    }

    // (c) B15: Venus 1-2 steps from bonus step or completion — do NOT destroy card
    if (resolver.isNearBonusStep('venus')) {
      // Pristar's cube cancels only the first of the 2 steps
      const steps = resolver.interceptsRaise(GlobalParameter.VENUS) ? 1 : 2;
      resolver.game.increaseVenusScaleLevel(resolver.botPlayer, steps);
      resolver.game.log('MarsBot raises Venus ${0} step(s) (Lobbyists Venus)', (b) => b.number(steps));
      return false;
    }

    resolver.advanceFurthestParameter();
    return false;
  },
};
