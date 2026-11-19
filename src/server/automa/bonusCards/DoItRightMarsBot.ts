import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

// Inventrix: the first of Lobbyists' temperature, oxygen and ocean branches that applies
export class DoItRightMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B25_DO_IT_RIGHT});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    if (resolver.lobbyistsTempBranch('Do It Right') ||
      resolver.lobbyistsOxygenBranch('Do It Right') ||
      resolver.lobbyistsOceanBranch('Do It Right')) {
      return false;
    }
    resolver.game.log('MarsBot resolves Do It Right: no effect');
    return false;
  }
}
