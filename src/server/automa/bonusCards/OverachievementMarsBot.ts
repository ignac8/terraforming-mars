import {BonusCardId} from '@/common/automa/AutomaTypes';
import {marsBotMapRules} from '@/common/automa/MarsBotMapRules';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

// B04: Overachievement
export class OverachievementMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B04_OVERACHIEVEMENT});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    // Claim a milestone; failing that, fund an award once the map's generation threshold for it is reached
    const {generationShift} = marsBotMapRules(resolver.game.gameOptions.boardName);
    const done = resolver.turnResolver.maybeClaimMilestone() ||
      (resolver.game.generation >= 6 + generationShift && resolver.turnResolver.maybeFundAward());
    if (done) {
      resolver.game.log('Overachievement is destroyed');
      return true;
    }
    resolver.turnResolver.gainMc(5);
    resolver.game.log('MarsBot gains 5 MC (Overachievement failed)');
    return false;
  }
}
