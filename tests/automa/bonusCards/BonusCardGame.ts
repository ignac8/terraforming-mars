import {MarsBot} from '@/server/automa/MarsBot';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';

/** Puts every track of MarsBot's board on its last space, so that advancing any of them fails. */
export function maxTracks(marsBot: MarsBot): void {
  for (const track of marsBot.marsBotBoard.tracks) {
    track.position = track.definition.layout.length - 1;
  }
}

/** The ids of the bonus cards in MarsBot's bonus deck, draw pile first, then the discards. */
export function bonusDeckIds(marsBot: MarsBot): Array<string> {
  return [...marsBot.bonusDeck.drawPile, ...marsBot.bonusDeck.discardPile].map((c) => (c as MarsBotBonusCard).id);
}

/** The ids of the bonus cards in MarsBot's action deck. A project card has none. */
export function actionDeckIds(marsBot: MarsBot): Array<string | undefined> {
  return marsBot.actionDeck.map((c) => (c as MarsBotBonusCard).id);
}
