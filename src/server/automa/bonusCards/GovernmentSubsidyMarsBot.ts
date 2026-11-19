import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

export class GovernmentSubsidyMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B31_GOVERNMENT_SUBSIDY});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    // UNMI: raise TR 1 step
    marsBot.player.increaseTerraformRating(1);
    marsBot.game.log('MarsBot resolves Government Subsidy: +1 TR');
    return false;
  }
}
