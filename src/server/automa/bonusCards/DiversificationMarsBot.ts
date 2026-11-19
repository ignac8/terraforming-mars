import {BonusCardId} from '@/common/automa/AutomaTypes';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {maybeAdvanceTrack} from '@/server/automa/bonusCards/bonusCardHelpers';

export class DiversificationMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B28_DIVERSIFICATION});
  }

  public override resolve(marsBot: IMarsBot): boolean {
    // Robinson Industries: advance least-advanced track, then lose up to 4 M€
    const marsBotBoard = marsBot.marsBotBoard;
    const leastIndex = marsBotBoard.getLeastAdvancedTrackIndex();
    maybeAdvanceTrack(marsBot, leastIndex);
    const lost = Math.min(4, marsBot.megacredits);
    marsBot.megacredits -= lost;
    marsBot.game.log('MarsBot resolves Diversification: advance least-advanced track, lose ${0} M€', (b) => b.number(lost));
    return false;
  }
}
