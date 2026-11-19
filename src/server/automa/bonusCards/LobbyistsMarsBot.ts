import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

// B06: Lobbyists / B15: Lobbyists (Venus) — shared (a) temp and (b) oxygen branches
export class LobbyistsMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B06_LOBBYISTS});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    if (resolver.lobbyistsTempBranch()) {
      return true;
    }
    if (resolver.lobbyistsOxygenBranch()) {
      return true;
    }

    // (c) B06: Ocean adjacent to 2+ oceans
    if (resolver.lobbyistsOceanBranch()) {
      return true;
    }

    resolver.advanceFurthestParameter();
    return false;
  }
}
