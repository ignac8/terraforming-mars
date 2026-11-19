import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

// B03: Research and Development
export class ResearchAndDevelopmentMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT});
  }

  public override resolve(resolver: MarsBotBonusResolver): boolean {
    const drawnCard = resolver.game.projectDeck.draw(resolver.game);
    if (drawnCard !== undefined) {
      resolver.game.log('MarsBot draws and resolves ${0} (R&D)', (b) => b.card(drawnCard));
      resolver.turnResolver.resolveProjectCard(drawnCard);
    }
    return false;
  }
}
