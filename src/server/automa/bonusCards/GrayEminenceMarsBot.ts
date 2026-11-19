import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {MarsBotTurmoilHelper} from '@/server/automa/turmoil/MarsBotTurmoilHelper';

// B29: Gray Eminence (Septem Tribus — T-7 delegate placement, no T-8 repeat)
export class GrayEminenceMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B29_GRAY_EMINENCE});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    const turmoil = marsBot.game.turmoil;
    if (turmoil === undefined) {
      marsBot.game.log('MarsBot resolves Gray Eminence: Turmoil not active');
      return false;
    }
    // Up to 2 delegates, each to the party with the fewest MarsBot delegates, then the fewest
    // player delegates, then a random one. 2 M€ for each delegate it can't place.
    for (let i = 0; i < 2; i++) {
      if (!turmoil.delegateReserve.has(marsBot.player)) {
        marsBot.gainMc(2);
        marsBot.game.log('MarsBot resolves Gray Eminence: no delegate in reserve, +2 M€');
        continue;
      }
      const partyName = new MarsBotTurmoilHelper(marsBot.game).selectGrayEminenceParty();
      turmoil.sendDelegateToParty(marsBot.player, partyName, marsBot.game);
      marsBot.game.log('MarsBot places delegate in ${0} (Gray Eminence)', (b) => b.partyName(partyName));
    }
    return false;
  }
}
