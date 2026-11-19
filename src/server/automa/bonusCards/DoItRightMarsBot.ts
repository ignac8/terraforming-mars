import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {lobbyistsOceanBranch, lobbyistsOxygenBranch, lobbyistsTempBranch} from '@/server/automa/bonusCards/bonusCardHelpers';

// Inventrix: the first of Lobbyists' temperature, oxygen and ocean branches that applies
export class DoItRightMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B25_DO_IT_RIGHT});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    if (lobbyistsTempBranch(marsBot, 'Do It Right') ||
      lobbyistsOxygenBranch(marsBot, 'Do It Right') ||
      lobbyistsOceanBranch(marsBot, 'Do It Right')) {
      return false;
    }
    marsBot.game.log('MarsBot resolves Do It Right: no effect');
    return false;
  }
}
