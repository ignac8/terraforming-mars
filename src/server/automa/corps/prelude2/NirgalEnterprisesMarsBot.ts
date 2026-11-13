import {BonusCardId} from '@/common/automa/AutomaTypes';
import {marsBotMapRules} from '@/common/automa/MarsBotMapRules';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBotCorp} from '@/server/automa/IMarsBotCorp';

// C42 Nirgal Enterprises
export const NIRGAL_ENTERPRISES_MARSBOT_CORP: IMarsBotCorp = {
  name: CardName.NIRGAL_ENTERPRISES,
  description: 'Tags: Building, Power, Plant. Setup: remove Overachievement. +2 in every award. Generations 2-5 and 10+: claim milestone. Generations 6-9: fund award (each one generation later on Amazonis Planitia).',
  tags: [Tag.BUILDING, Tag.POWER, Tag.PLANT],
  setup(marsBot) {
    marsBot.removeBonusCard(BonusCardId.B04_OVERACHIEVEMENT);
    marsBot.game.log('MarsBot (Nirgal): Overachievement removed from bonus deck');
  },
  effect: {
    awardScoreBonus() {
      return 2;
    },
  },
  // Gen 2-5 or 10+: claim milestone. Gen 6-9: fund award. Neither is a Failed Action when it can't.
  // The windows after the first start one generation later on Amazonis Planitia.
  beforeActionPhase(marsBot) {
    const {generationShift} = marsBotMapRules(marsBot.game.gameOptions.boardName);
    const generation = marsBot.game.generation;
    if ((generation >= 2 && generation <= 5 + generationShift) || generation >= 10 + generationShift) {
      if (!marsBot.maybeClaimMilestone()) {
        marsBot.game.log('MarsBot (Nirgal): no milestone to claim');
      }
    } else if (generation >= 6 + generationShift && generation <= 9 + generationShift) {
      if (!marsBot.maybeFundAward()) {
        marsBot.game.log('MarsBot (Nirgal): no award to fund');
      }
    }
  },
};
