import {BonusCardId} from '@/common/automa/AutomaTypes';
import {marsBotMapRules} from '@/common/automa/MarsBotMapRules';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotCorp} from '@/server/automa/MarsBotCorp';

export class NirgalEnterprisesMarsBot extends MarsBotCorp {
  constructor() {
    super({
      name: CardName.NIRGAL_ENTERPRISES,
      description: 'Tags: Building, Power, Plant. Setup: remove Overachievement. +2 in every award. Generations 2-5 and 10+: claim milestone. Generations 6-9: fund award (each one generation later on Amazonis Planitia).',
      tags: [Tag.BUILDING, Tag.POWER, Tag.PLANT],
    });
  }

  public override setup(marsBot: IMarsBot): void {
    marsBot.removeBonusCard(BonusCardId.B04_OVERACHIEVEMENT);
    marsBot.game.log('MarsBot (${0}): Overachievement removed from bonus deck', (b) => b.cardName(this.name));
  }

  public override awardScoreBonus(): number {
    return 2;
  }

  // Gen 2-5 or 10+: claim milestone. Gen 6-9: fund award. Neither is a Failed Action when it can't.
  // The windows after the first start one generation later on Amazonis Planitia.
  public override beforeActionPhase(marsBot: IMarsBot): void {
    const {generationShift} = marsBotMapRules(marsBot.game.gameOptions.boardName);
    const generation = marsBot.game.generation;
    if ((generation >= 2 && generation <= 5 + generationShift) || generation >= 10 + generationShift) {
      if (!marsBot.maybeClaimMilestone()) {
        marsBot.game.log('MarsBot (${0}): no milestone to claim', (b) => b.cardName(this.name));
      }
    } else if (generation >= 6 + generationShift && generation <= 9 + generationShift) {
      if (!marsBot.maybeFundAward()) {
        marsBot.game.log('MarsBot (${0}): no award to fund', (b) => b.cardName(this.name));
      }
    }
  }
}
