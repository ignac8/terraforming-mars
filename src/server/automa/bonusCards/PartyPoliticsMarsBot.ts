import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {MarsBotTurmoilHelper} from '@/server/automa/turmoil/MarsBotTurmoilHelper';

// B21: Party Politics (T-7, T-8)
export class PartyPoliticsMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B21_PARTY_POLITICS});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    const turmoil = marsBot.game.turmoil;
    if (turmoil === undefined) {
      marsBot.game.log('MarsBot resolves Party Politics: Turmoil not active');
      return false;
    }
    // T-7: Place 1 delegate from reserve using the priority list
    const placed = new MarsBotTurmoilHelper(marsBot.game).maybePlaceDelegate();
    if (placed === undefined) {
      marsBot.game.log('MarsBot resolves Party Politics: no delegates in reserve');
      return false;
    }

    // T-8: If ≥1 delegate still in reserve AND MarsBot has ≥5 MC:
    //       flip a project deck card — if its cost is divisible by 3, spend 5 MC and place another delegate
    if (turmoil.delegateReserve.has(marsBot.player) && marsBot.megacredits >= 5) {
      const flipped = marsBot.game.projectDeck.draw(marsBot.game);
      if (flipped !== undefined) {
        marsBot.game.log('MarsBot flips ${0} (cost ${1}) for Party Politics T-8 check', (b) => b.card(flipped).number(flipped.cost));
        marsBot.game.projectDeck.discardPile.push(flipped);
        if (flipped.cost % 3 === 0) {
          marsBot.megacredits -= 5;
          marsBot.game.log('MarsBot spends 5 M€ to place a second delegate (Party Politics T-8)');
          new MarsBotTurmoilHelper(marsBot.game).maybePlaceDelegate();
        }
      }
    }
    return false;
  }
}
