import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {advanceFurthestParameter, lobbyistsOceanBranch, lobbyistsOxygenBranch, lobbyistsTempBranch} from '@/server/automa/bonusCards/bonusCardHelpers';

// B06: Lobbyists / B15: Lobbyists (Venus) — shared (a) temp and (b) oxygen branches
export class LobbyistsMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B06_LOBBYISTS});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    if (lobbyistsTempBranch(marsBot)) {
      return true;
    }
    if (lobbyistsOxygenBranch(marsBot)) {
      return true;
    }

    // (c) B06: Ocean adjacent to 2+ oceans
    if (lobbyistsOceanBranch(marsBot)) {
      return true;
    }

    advanceFurthestParameter(marsBot);
    return false;
  }
}
