import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B03: Research and Development
export class ResearchAndDevelopmentMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    const drawnCard = marsBot.game.projectDeck.draw(marsBot.game);
    if (drawnCard !== undefined) {
      marsBot.game.log('MarsBot draws and resolves ${0} (R&D)', (b) => b.card(drawnCard));
      marsBot.resolveProjectCard(drawnCard);
    }
    return false;
  }
}
