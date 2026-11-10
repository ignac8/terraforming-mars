import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B21: Party Politics (T-7, T-8)
export const PARTY_POLITICS_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B21_PARTY_POLITICS,
  resolve(resolver) {
    const turmoil = resolver.game.turmoil;
    if (turmoil === undefined) {
      resolver.game.log('MarsBot resolves Party Politics: Turmoil not active');
      return false;
    }
    // T-7: Place 1 delegate from reserve using the priority list
    const placed = resolver.turmoilHelper().maybePlaceDelegate();
    if (placed === undefined) {
      resolver.game.log('MarsBot resolves Party Politics: no delegates in reserve');
      return false;
    }

    // T-8: If ≥1 delegate still in reserve AND MarsBot has ≥5 MC:
    //       flip a project deck card — if its cost is divisible by 3, spend 5 MC and place another delegate
    if (turmoil.delegateReserve.has(resolver.botPlayer) && resolver.turnResolver.megacredits >= 5) {
      const flipped = resolver.game.projectDeck.draw(resolver.game);
      if (flipped !== undefined) {
        resolver.game.log('MarsBot flips ${0} (cost ${1}) for Party Politics T-8 check', (b) => b.card(flipped).number(flipped.cost));
        resolver.game.projectDeck.discardPile.push(flipped);
        if (flipped.cost % 3 === 0) {
          resolver.turnResolver.megacredits -= 5;
          resolver.game.log('MarsBot spends 5 M€ to place a second delegate (Party Politics T-8)');
          resolver.turmoilHelper().maybePlaceDelegate();
        }
      }
    }
    return false;
  },
};
