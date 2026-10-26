import {CardModel} from '@/common/models/CardModel';
import {PrivatePlayerFields} from '@/common/models/PlayerModel';

export type PrivateCardSection = {title: string, cards: ReadonlyArray<CardModel>};

/**
 * The cards a player holds that the table can't see, as titled sections, empty ones left out.
 *
 * The server keeps the dealt cards all game. Like the player page, show them only until something is in play.
 */
export function privateCardSections(p: PrivatePlayerFields, tableauLength: number): Array<PrivateCardSection> {
  const sections: Array<PrivateCardSection> = [
    {title: 'Cards In Hand', cards: p.cardsInHand},
    {title: 'Drafted cards', cards: p.draftedCards},
  ];
  // These only matter while the player picks a corporation and starting cards.
  if (tableauLength === 0) {
    sections.push(
      {title: 'Dealt corporations', cards: p.dealtCorporationCards},
      {title: 'Dealt preludes', cards: p.dealtPreludeCards},
      {title: 'Dealt CEOs', cards: p.dealtCeoCards},
      {title: 'Dealt project cards', cards: p.dealtProjectCards},
      {title: 'Picked corporation', cards: p.pickedCorporationCard},
    );
  }
  sections.push(
    {title: 'Preludes in hand', cards: p.preludeCardsInHand},
    {title: 'CEOs in hand', cards: p.ceoCardsInHand},
  );
  return sections.filter((section) => section.cards.length > 0);
}
