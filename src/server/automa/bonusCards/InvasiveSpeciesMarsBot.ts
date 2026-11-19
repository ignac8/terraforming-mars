import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

// B02: Invasive Species
export class InvasiveSpeciesMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B02_INVASIVE_SPECIES});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    resolver.maybeRemoveAnimalOrMicrobe('Invasive Species');
    // a. With Venus Next or Colonies, MarsBot gains 2 M€ and 1 floater; b. otherwise 5 M€
    const opts = resolver.game.gameOptions;
    if (opts.venusNextExtension || opts.coloniesExtension) {
      resolver.turnResolver.gainMc(2);
      resolver.turnResolver.gainFloaters(1);
      resolver.game.log('MarsBot gains 2 MC and 1 floater from Invasive Species');
    } else {
      resolver.turnResolver.gainMc(5);
      resolver.game.log('MarsBot gains 5 MC from Invasive Species');
    }
    // Card is NOT destroyed in base game
    return false;
  }
}
