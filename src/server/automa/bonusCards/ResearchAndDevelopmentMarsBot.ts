import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B03: Research and Development
export const RESEARCH_AND_DEVELOPMENT_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT,
  resolve(resolver) {
    const drawnCard = resolver.game.projectDeck.draw(resolver.game);
    if (drawnCard !== undefined) {
      resolver.game.log('MarsBot draws and resolves ${0} (R&D)', (b) => b.card(drawnCard));
      resolver.turnResolver.resolveProjectCard(drawnCard);
    }
    return false;
  },
};
