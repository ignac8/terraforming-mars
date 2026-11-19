import {GlobalParameter} from '@/common/GlobalParameter';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {advanceFurthestParameter, isNearBonusStep, lobbyistsOxygenBranch, lobbyistsTempBranch} from '@/server/automa/bonusCards/bonusCardHelpers';

export class LobbyistsVenusMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B15_LOBBYISTS_VENUS});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    if (lobbyistsTempBranch(marsBot)) {
      return true;
    }
    if (lobbyistsOxygenBranch(marsBot)) {
      return true;
    }

    // (c) B15: Venus 1-2 steps from bonus step or completion — do NOT destroy card
    if (isNearBonusStep(marsBot.game, 'venus')) {
      // Pristar's cube cancels only the first of the 2 steps
      const steps = marsBot.interceptsParameterRaise(GlobalParameter.VENUS) ? 1 : 2;
      marsBot.game.increaseVenusScaleLevel(marsBot.player, steps);
      marsBot.game.log('MarsBot raises Venus ${0} step(s) (Lobbyists Venus)', (b) => b.number(steps));
      return false;
    }

    advanceFurthestParameter(marsBot);
    return false;
  }
}
