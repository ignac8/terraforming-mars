import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B29: Gray Eminence (Septem Tribus — T-7 delegate placement, no T-8 repeat)
export const GRAY_EMINENCE_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B29_GRAY_EMINENCE,
  resolve(resolver) {
    const turmoil = resolver.game.turmoil;
    if (turmoil === undefined) {
      resolver.game.log('MarsBot resolves Gray Eminence: Turmoil not active');
      return false;
    }
    // Up to 2 delegates, each to the party with the fewest MarsBot delegates, then the fewest
    // player delegates, then a random one. 2 M€ for each delegate it can't place.
    for (let i = 0; i < 2; i++) {
      if (!turmoil.delegateReserve.has(resolver.botPlayer)) {
        resolver.turnResolver.gainMc(2);
        resolver.game.log('MarsBot resolves Gray Eminence: no delegate in reserve, +2 M€');
        continue;
      }
      const partyName = resolver.turmoilHelper().selectGrayEminenceParty();
      turmoil.sendDelegateToParty(resolver.botPlayer, partyName, resolver.game);
      resolver.game.log('MarsBot places delegate in ${0} (Gray Eminence)', (b) => b.partyName(partyName));
    }
    return false;
  },
};
