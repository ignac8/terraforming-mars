import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// Factorum: take up to 3 M€ from the corp card; with none taken, advance the energy track
export const SUPPLY_AND_DEMAND_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B24_SUPPLY_AND_DEMAND,
  resolve(resolver) {
    const marsBot = resolver.marsBotManager;
    const taken = Math.min(3, marsBot?.getCorpState('mcOnCard') ?? 0);
    if (marsBot !== undefined && taken > 0) {
      marsBot.setCorpState('mcOnCard', marsBot.getCorpState('mcOnCard') - taken);
      resolver.turnResolver.gainMc(taken);
      resolver.game.log('MarsBot resolves Supply & Demand: takes ${0} M€ from the corporation card', (b) => b.number(taken));
    } else {
      resolver.maybeAdvanceTrack(4);
      resolver.game.log('MarsBot resolves Supply & Demand: advance energy track');
    }
    return false;
  },
};
