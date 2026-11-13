import {GlobalParameter} from '@/common/GlobalParameter';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import * as constants from '@/common/constants';
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
    const venus = resolver.game.getVenusScaleLevel();
    const venusBonusTargets = [constants.VENUS_LEVEL_FOR_CARD_BONUS, constants.VENUS_LEVEL_FOR_TR_BONUS, resolver.game.max.venus];
    const venusStepsToNextBonus = venusBonusTargets
      .filter((v) => v > venus)
      .map((v) => (v - venus) / 2)
      .reduce((min, s) => Math.min(min, s), Infinity);
    if (venusStepsToNextBonus >= 1 && venusStepsToNextBonus <= 2 && venus < resolver.game.max.venus) {
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
