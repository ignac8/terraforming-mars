import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B16: Government Intervention
export const GOVERNMENT_INTERVENTION_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B16_GOVERNMENT_INTERVENTION,
  resolve(resolver) {
    const venus = resolver.game.getVenusScaleLevel();
    const isEvenGen = resolver.game.generation % 2 === 0;
    const venusComplete = venus >= resolver.game.max.venus;

    // Only the first effect that is possible is evaluated: with every Martian parameter at its
    // maximum, an even generation falls through to raising Venus (rulebook C, p.3)
    let advanced = false;
    if (isEvenGen || venusComplete) {
      resolver.withoutTRorMcGain(() => {
        advanced = resolver.advanceFurthestParameter(false);
      });
    }
    if (!advanced && venus < resolver.game.max.venus) {
      // FAQ (rulebook B, p.4): Aphrodite's 2 M€ per Venus step still applies, and raising
      // Venus pays MarsBot no other M€, so the 8% bonus pays nothing, nor does the colony Amazonis
      // Planitia prints at 16% (`handleVenusRaised`).
      const marsBot = resolver.marsBotManager;
      resolver.withoutTRGain(() => {
        if (marsBot !== undefined) {
          marsBot.bonusMcBlocked = true;
        }
        try {
          resolver.game.increaseVenusScaleLevel(resolver.botPlayer, 1);
        } finally {
          if (marsBot !== undefined) {
            marsBot.bonusMcBlocked = false;
          }
        }
      });
    }
    return false;
  },
};
