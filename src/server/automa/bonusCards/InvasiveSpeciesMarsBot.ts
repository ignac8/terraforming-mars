import {BonusCardId} from '@/common/automa/AutomaTypes';
import {ColonyName} from '@/common/colonies/ColonyName';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {maybeRemoveAnimalOrMicrobe} from '@/server/automa/bonusCards/bonusCardHelpers';

// B02: Invasive Species
export class InvasiveSpeciesMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B02_INVASIVE_SPECIES});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    maybeRemoveAnimalOrMicrobe(marsBot, 'Invasive Species');
    // a. With Venus Next or Colonies, MarsBot gains 2 M€ and 1 floater; b. otherwise 5 M€
    const opts = marsBot.game.gameOptions;
    if (opts.venusNextExtension || opts.coloniesExtension) {
      marsBot.gainMc(2);
      // Without Venus Next the floater goes to Titan's storage area, and nowhere when Titan isn't in play (C-13, C-14)
      if (opts.venusNextExtension) {
        marsBot.addFloaters(1);
        marsBot.game.log('MarsBot gains ${0} floater(s)', (b) => b.number(1));
      } else if (marsBot.game.colonies.some((colony) => colony.name === ColonyName.TITAN)) {
        marsBot.addFloaters(1);
        marsBot.game.log('MarsBot gains ${0} floater token(s) in Titan storage (C-14)', (b) => b.number(1));
      }
      marsBot.game.log('MarsBot gains 2 MC and 1 floater from Invasive Species');
    } else {
      marsBot.gainMc(5);
      marsBot.game.log('MarsBot gains 5 MC from Invasive Species');
    }
    // Card is NOT destroyed in base game
    return false;
  }
}
