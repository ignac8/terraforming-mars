import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';

// B07: Local Neural Instance. The card is removed only once its tile is placed.
export class LocalNeuralInstanceMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B07_LOCAL_NEURAL_INSTANCE});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    const space = new MarsBotTilePlacer(marsBot).findNeuralInstanceSpace();
    if (space !== undefined) {
      marsBot.placeNeuralInstance(space);
      marsBot.game.log('MarsBot places Neural Instance tile');
      marsBot.game.log('Local Neural Instance is destroyed');
      return true;
    }
    // Can't place: draw and resolve a project card. The card is not destroyed; designer ruling,
    // BGG thread 3350125 (njshaw2, confirmed by TDaver).
    const drawnCard = marsBot.game.projectDeck.draw(marsBot.game);
    if (drawnCard !== undefined) {
      marsBot.game.log('MarsBot draws and resolves ${0} (Neural Instance fallback)', (b) => b.card(drawnCard));
      marsBot.resolveProjectCard(drawnCard);
    }
    return false;
  }
}
