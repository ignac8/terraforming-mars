import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

export class GovernmentSubsidyMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B31_GOVERNMENT_SUBSIDY});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    // UNMI: raise TR 1 step
    resolver.botPlayer.increaseTerraformRating(1);
    resolver.game.log('MarsBot resolves Government Subsidy: +1 TR');
    return false;
  }
}
