import {getCard} from '@/client/cards/ClientCardManifest';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/** Every card anywhere in the input, its options included, in order and each once. */
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

function isStandardProject(name: CardName): boolean {
  const type = getCard(name)?.type;
  return type === CardType.STANDARD_PROJECT || type === CardType.STANDARD_ACTION;
}

/**
 * The cards of a pending input that a judge sees nowhere else, like a draft hand. `shown` is what the judge already
 * sees of the player, in their sections or on the table. Standard projects are the same for everyone.
 */
export function unseenPendingCards(input: PlayerInputModel, shown: ReadonlyArray<CardName>): Array<CardModel> {
  const all = new Map<CardName, CardModel>();
  collectCards(input, all);
  return Array.from(all.values()).filter((card) => !shown.includes(card.name) && !isStandardProject(card.name));
}
