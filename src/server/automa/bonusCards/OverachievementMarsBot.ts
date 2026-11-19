import {BonusCardId} from '@/common/automa/AutomaTypes';
import {marsBotMapRules} from '@/common/automa/MarsBotMapRules';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B04: Overachievement
export class OverachievementMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B04_OVERACHIEVEMENT});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    // Claim a milestone; failing that, fund an award once the map's generation threshold for it is reached
    const {generationShift} = marsBotMapRules(marsBot.game.gameOptions.boardName);
    const done = marsBot.maybeClaimMilestone() ||
      (marsBot.game.generation >= 6 + generationShift && marsBot.maybeFundAward());
    if (done) {
      marsBot.game.log('Overachievement is destroyed');
      return true;
    }
    marsBot.gainMc(5);
    marsBot.game.log('MarsBot gains 5 MC (Overachievement failed)');
    return false;
  }
}
