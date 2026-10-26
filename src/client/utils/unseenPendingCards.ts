import {getCard} from '@/client/cards/ClientCardManifest';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {PrivatePlayerFields} from '@/common/models/PlayerModel';
import {privateCardSections} from '@/client/utils/privateCardSections';

function isStandardProject(name: CardName): boolean {
  const type = getCard(name)?.type;
  return type === CardType.STANDARD_PROJECT || type === CardType.STANDARD_ACTION;
}

/** What the judge already sees of a player: the cards of their sections and those on the table. */
export function shownCardNames(privates: PrivatePlayerFields, tableau: ReadonlyArray<CardModel>): Array<CardName> {
  return [...privateCardSections(privates, tableau.length).flatMap((section) => section.cards), ...tableau].map((card) => card.name);
}

/**
 * The cards of a pending choice that the viewer sees nowhere else, like a draft hand or the cards on offer in the
 * research phase. Standard projects are the same for everyone.
 */
export function unseenPendingCards(cards: ReadonlyArray<CardModel>, shown: ReadonlyArray<CardName>): Array<CardModel> {
  return cards.filter((card) => !shown.includes(card.name) && !isStandardProject(card.name));
}
