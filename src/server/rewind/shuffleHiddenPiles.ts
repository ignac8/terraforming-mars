import {SerializedGame} from '../SerializedGame';
import {Random} from '../../common/utils/Random';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {inplaceShuffle} from '../utils/shuffle';

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
    inplaceShuffle(d.automaState.actionDeckCardNames, random);
    shuffleBonusDeck(d.automaState.bonusDeckDrawPile, random);
  }

  d.seed = random.next();
  d.currentSeed = Math.floor(d.seed * 4294967296);
}

/** The deck draws from the end. A MarsBot prelude puts Interface Hyperlink at index 0 on purpose, so it stays there. */
function shuffleBonusDeck(drawPile: Array<string>, random: Random): void {
  if (drawPile[0] === BonusCardId.B30_INTERFACE_HYPERLINK) {
    const rest = drawPile.slice(1);
    inplaceShuffle(rest, random);
    drawPile.splice(1, rest.length, ...rest);
  } else {
    inplaceShuffle(drawPile, random);
  }
}
