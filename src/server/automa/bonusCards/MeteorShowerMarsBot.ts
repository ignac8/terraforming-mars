import {Resource} from '@/common/Resource';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B01: Meteor Shower
export const METEOR_SHOWER_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B01_METEOR_SHOWER,
  resolve(resolver) {
    // Asteroid Deflection System and Protected Habitat block plant removal
    if (resolver.humanPlayer.plantsAreProtected()) {
      resolver.game.log('MarsBot\'s Meteor Shower: blocked by plant protection');
      resolver.game.log('Meteor Shower is destroyed');
      return true;
    }
    const plantsLost = Math.min(5, resolver.humanPlayer.plants);
    if (plantsLost > 0) {
      // Coming from MarsBot, so the player may Law Suit it.
      resolver.humanPlayer.stock.deduct(Resource.PLANTS, plantsLost, {from: {player: resolver.botPlayer}});
      resolver.game.log('MarsBot\'s Meteor Shower: ${0} loses ${1} plants', (b) => b.player(resolver.humanPlayer).number(plantsLost));
    }
    if (plantsLost >= 3) {
      resolver.game.log('Meteor Shower is destroyed');
      return true;
    }
    return false;
  },
};
