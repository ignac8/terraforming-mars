import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {maybeAdvanceTrack} from '@/server/automa/bonusCards/bonusCardHelpers';

// Factorum: take up to 3 M€ from the corp card; with none taken, advance the energy track
export class SupplyAndDemandMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B24_SUPPLY_AND_DEMAND});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    const taken = Math.min(3, marsBot.getCorpState('mcOnCard'));
    if (taken > 0) {
      marsBot.setCorpState('mcOnCard', marsBot.getCorpState('mcOnCard') - taken);
      marsBot.gainMc(taken);
      marsBot.game.log('MarsBot resolves Supply & Demand: takes ${0} M€ from the corporation card', (b) => b.number(taken));
    } else {
      maybeAdvanceTrack(marsBot, 4);
      marsBot.game.log('MarsBot resolves Supply & Demand: advance energy track');
    }
    return false;
  }
}
