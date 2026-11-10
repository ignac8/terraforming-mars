import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';

// B07: Local Neural Instance. The card is removed only once its tile is placed.
export const LOCAL_NEURAL_INSTANCE_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B07_LOCAL_NEURAL_INSTANCE,
  resolve(resolver) {
    const space = resolver.tilePlacer.findNeuralInstanceSpace();
    if (space !== undefined) {
      resolver.game.simpleAddTile(resolver.botPlayer, space, {tileType: TileType.NEURAL_INSTANCE});
      resolver.turnResolver.gainMc(resolver.tilePlacer.getTotalPlacementMC(space));
      resolver.game.automaHooks?.handleTilePlaced(resolver.botPlayer, TileType.NEURAL_INSTANCE, space);
      resolver.onNeuralInstancePlaced?.(space);
      resolver.game.log('MarsBot places Neural Instance tile');
      resolver.game.log('Local Neural Instance is destroyed');
      return true;
    }
    // Can't place: draw and resolve a project card. The card is not destroyed; designer ruling,
    // BGG thread 3350125 (njshaw2, confirmed by TDaver).
    const drawnCard = resolver.game.projectDeck.draw(resolver.game);
    if (drawnCard !== undefined) {
      resolver.game.log('MarsBot draws and resolves ${0} (Neural Instance fallback)', (b) => b.card(drawnCard));
      resolver.turnResolver.resolveProjectCard(drawnCard);
    }
    return false;
  },
};
