// Stub — real implementation in PR 7
import {IProjectCard} from '../../cards/IProjectCard';
import {MarsBotDraftPriority} from '../../../common/automa/MarsBotCorpTypes';
import {MarsBotBoard} from '../MarsBotBoard';
import {Random} from '../../../common/utils/Random';
export class MarsBotDraftResolver {
  static pickCardForMarsBot(cards: IProjectCard[], _priority: MarsBotDraftPriority, rng: Random, _board: MarsBotBoard): IProjectCard {
    return cards[rng.nextInt(cards.length)];
  }
  static postDraftDiscard(cards: IProjectCard[], _priority: MarsBotDraftPriority, _rng: Random): {kept: IProjectCard[], discarded: IProjectCard[]} {
    return {kept: cards, discarded: []};
  }
}
