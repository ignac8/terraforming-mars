import {Resource} from '@/common/Resource';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B01: Meteor Shower
export class MeteorShowerMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B01_METEOR_SHOWER});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    // Asteroid Deflection System and Protected Habitat block plant removal
    if (marsBot.humanPlayer.plantsAreProtected()) {
      marsBot.game.log('MarsBot\'s Meteor Shower: blocked by plant protection');
      marsBot.game.log('Meteor Shower is destroyed');
      return true;
    }
    const plantsLost = Math.min(5, marsBot.humanPlayer.plants);
    if (plantsLost > 0) {
      // Coming from MarsBot, so the player may Law Suit it.
      marsBot.humanPlayer.stock.deduct(Resource.PLANTS, plantsLost, {from: {player: marsBot.player}});
      marsBot.game.log('MarsBot\'s Meteor Shower: ${0} loses ${1} plants', (b) => b.player(marsBot.humanPlayer).number(plantsLost));
    }
    if (plantsLost >= 3) {
      marsBot.game.log('Meteor Shower is destroyed');
      return true;
    }
    return false;
  }
}
