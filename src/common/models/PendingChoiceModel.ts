import {CardName} from '../cards/CardName';
import {Message} from '../logs/Message';
import {CardModel} from './CardModel';
import {PlayerInputModel} from './PlayerInputModel';

/**
 * What a player is deciding, and every card they decide among, like the cards on offer in the research phase. A
 * read-only summary of a prompt for someone who may see it but never answer it, so it carries no input.
 */
export type PendingChoiceModel = {
  title: string | Message;
  cards: ReadonlyArray<CardModel>;
};

function collectCards(input: PlayerInputModel, into: Map<CardName, CardModel>): void {
  if ('cards' in input) {
    for (const card of input.cards) {
      if (!into.has(card.name)) {
        into.set(card.name, card);
      }
    }
  }
  if ('options' in input) {
    for (const option of input.options) {
      collectCards(option, into);
    }
  }
}

/** The cards anywhere in the input, its options included, in order and each once. */
export function pendingChoiceOf(input: PlayerInputModel): PendingChoiceModel {
  const cards = new Map<CardName, CardModel>();
  collectCards(input, cards);
  return {title: input.title, cards: Array.from(cards.values())};
}
