import {BonusCardName} from '@/common/automa/BonusCardName';
import {marsBotMapRules} from '@/common/automa/MarsBotMapRules';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCard';

export class Overachievement extends MarsBotBonusCard {
  constructor() {
    super(BonusCardName.OVERACHIEVEMENT);
  }

  public override resolve(marsBot: IMarsBot): boolean {
    // Claim a milestone; failing that, fund an award once the map's generation threshold for it is reached
    const {generationShift} = marsBotMapRules(marsBot.game.gameOptions.boardName);
    let done = marsBot.maybeClaimMilestone();
    if (!done && marsBot.game.generation >= 6 + generationShift) {
      done = marsBot.maybeFundAward();
    }
    if (done) {
      marsBot.game.log('Overachievement is destroyed');
      return true;
    }
    marsBot.gainMc(5);
    marsBot.game.log('MarsBot gains 5 MC (Overachievement failed)');
    return false;
  }
}
