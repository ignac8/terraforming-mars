import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

/** The Corporate Competition helpers that don't cost MarsBot 5 M€ (rulebook C, p.12). */
const FREE_HELPER_AWARDS: ReadonlyArray<string> = ['Forecaster'];

// B08: Corporate Competition
export const CORPORATE_COMPETITION_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B08_CORPORATE_COMPETITION,
  resolve(resolver) {
    const canPay = resolver.turnResolver.megacredits >= 5;
    const funded = resolver.game.awards.filter((a) => resolver.game.hasBeenFunded(a));
    if (!canPay || funded.length === 0) {
      // Not enough MC or nothing funded, draw another bonus card
      resolver.drawAndResolveAnotherBonus();
      return false;
    }

    // The closest award is the one the player leads by the least or is tied on. If MarsBot
    // leads every funded award, it is the one with the smallest gap.
    let resolved = false;
    const sorted = funded.map((a) => {
      const humanVal = resolver.turnResolver.getHumanAwardValueForComparison(a);
      const marsBotVal = resolver.turnResolver.getMarsBotAwardValue(a);
      return {award: a, margin: humanVal - marsBotVal};
    }).sort((a, b) => {
      if ((a.margin >= 0) !== (b.margin >= 0)) {
        return a.margin >= 0 ? -1 : 1;
      }
      return Math.abs(a.margin) - Math.abs(b.margin);
    });

    for (const {award} of sorted) {
      if (resolver.tryHelperAction(award.name)) {
        if (FREE_HELPER_AWARDS.includes(award.name)) {
          resolver.game.log('MarsBot resolves Corporate Competition on ${0}', (b) => b.rawString(award.name));
        } else {
          // A helper can itself cost M€ (a colony cube), so MarsBot may have less than 5 left
          const lost = Math.min(5, resolver.turnResolver.megacredits);
          resolver.turnResolver.megacredits -= lost;
          resolver.game.log('MarsBot resolves Corporate Competition on ${0}, loses ${1} MC', (b) => b.rawString(award.name).number(lost));
        }
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      resolver.drawAndResolveAnotherBonus();
    }
    return false;
  },
};
