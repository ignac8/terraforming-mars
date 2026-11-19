import {CardName} from '../../common/cards/CardName';
import {InputResponse} from '../../common/inputs/InputResponse';
import {Phase} from '../../common/Phase';
import {PlayerId} from '../../common/Types';
import {SerializedGame} from '../SerializedGame';
import {RecordedInput} from '../rewind/RecordedInput';

/** The cards that one player chose with one answer. `auto`: the draft handed them over without asking. */
export type PlayerPick = {playerId: PlayerId; cards: Array<CardName>; auto?: boolean};

/** A save in the middle of a draft round: every player's hand, in seat order, and who has yet to pick. */
export type DraftHands = ReadonlyArray<{playerId: PlayerId; needsToDraft: boolean; hand: ReadonlyArray<CardName>}>;

// The cards of every card answer in `response`, in the order they were given.
function cardAnswers(response: InputResponse): Array<Array<CardName>> {
  switch (response.type) {
  case 'card':
    return [[...response.cards]];
  case 'or':
    return cardAnswers(response.response);
  case 'and':
  case 'initialCards':
    return response.responses.flatMap(cardAnswers);
  default:
    return [];
  }
}

/** The cards chosen by the recorded answers: one entry per card answer, wherever it is nested in the response. */
export function picksOf(inputs: ReadonlyArray<RecordedInput> | undefined): Array<PlayerPick> {
  return (inputs ?? []).flatMap((input) => cardAnswers(input.response).map((cards) => ({playerId: input.playerId, cards})));
}

/** The hands of a save that is in a draft where someone has yet to pick. Undefined for any other save. */
export function draftHandsOf(save: SerializedGame): DraftHands | undefined {
  if (save.phase !== Phase.DRAFTING && save.phase !== Phase.INITIALDRAFTING) {
    return undefined;
  }
  const hands = save.players.map((p) => ({playerId: p.id, needsToDraft: p.needsToDraft === true, hand: p.draftHand}));
  return hands.some((p) => p.needsToDraft) ? hands : undefined;
}

/**
 * The cards that the draft handed over without asking, because of the answers `after` recorded: the last card
 * of every hand, handed over when the last player of a round picks and no more than one card is left in their hand.
 * `before` is the save the answers were applied to, and `after` the one they led to. Each card went to the player
 * who holds it in `after`, wherever the end of the round put it, so the direction of the pass need not be known.
 * One entry per receiving player, in seat order. Empty when the answers did not end a round of the draft.
 */
export function autoPicksOf(before: DraftHands | undefined, picks: ReadonlyArray<PlayerPick>, after: SerializedGame): Array<PlayerPick> {
  const waiting = (before ?? []).filter((p) => p.needsToDraft);
  if (before === undefined || waiting.length !== 1) {
    return [];
  }
  const [picker] = waiting;
  const chosen = picks.find((pick) => pick.playerId === picker.playerId)?.cards;
  if (chosen === undefined || picker.hand.length - chosen.length > 1) {
    return [];
  }
  const last = before.flatMap((p) => p.playerId === picker.playerId ? p.hand.filter((card) => !chosen.includes(card)) : p.hand);
  return after.players.flatMap((p) => {
    const kept = [...p.draftedCards, ...p.dealtProjectCards, ...p.dealtPreludeCards, ...p.dealtCeoCards];
    const cards = last.filter((card) => kept.includes(card));
    return cards.length === 0 ? [] : [{playerId: p.id, cards, auto: true}];
  });
}
