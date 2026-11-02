import {SerializedGame} from '../SerializedGame';
import {Random} from '../../common/utils/Random';
import {inplaceShuffle} from '../utils/shuffle';
import {shuffleMarsBotHiddenPiles} from '../automa/shuffleMarsBotHiddenPiles';

/**
 * Reorders every pile no player has seen, in a serialized game, and gives the game a new
 * random generator. Face-up information (hands, discards, the visible global events) is unchanged.
 *
 * It shuffles the draw piles alone. `Deck.shuffle()` also merges the discards back in.
 */
export function shuffleHiddenPiles(d: SerializedGame, random: Random): void {
  inplaceShuffle(d.projectDeck.drawPile, random);
  inplaceShuffle(d.corporationDeck.drawPile, random);
  inplaceShuffle(d.preludeDeck.drawPile, random);
  inplaceShuffle(d.ceoDeck.drawPile, random);
  if (d.turmoil !== undefined) {
    inplaceShuffle(d.turmoil.globalEventDealer.deck, random);
  }
  if (d.underworldData !== undefined) {
    inplaceShuffle(d.underworldData.tokens, random);
  }
  if (d.automaState !== undefined) {
    shuffleMarsBotHiddenPiles(d.automaState, random);
  }

  d.seed = random.next();
  d.currentSeed = Math.floor(d.seed * 4294967296);
}
