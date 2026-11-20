import {MarsBotBonusCard} from './MarsBotBonusCard';
import {MarsBotBonusDeckCard} from './bonusCards/MarsBotBonusCards';
import type {MarsBot} from './MarsBot';
import {ACTION_DECK_BONUS_CARD_REMOVED} from './corps/corpHelpers';

/**
 * Resolves MarsBot's bonus cards: resolves a card and keeps the bonus deck in order around it.
 */
export class MarsBotBonusResolver {
  constructor(private readonly marsBot: MarsBot) {}

  public resolve(card: MarsBotBonusDeckCard): boolean {
    const marsBot = this.marsBot;
    if (card.id === undefined) {
      // A project card from the bonus deck is played, so it leaves the bonus deck
      marsBot.resolveProjectCard(card);
      return false;
    }
    const destroyed = this.resolveEffect(card);
    // Only a destroyed card counts for the Land Specialist milestone, not one shuffled back into the deck.
    // A corporation's setup resolves and removes its cards without this (Philares), so it isn't in resolveEffect.
    if (destroyed && !marsBot.bonusDeck.drawPile.includes(card)) {
      marsBot.destroyedBonusCards++;
    }
    // A corporation's generation card that removes itself does not come back (Vitor's Overachievement)
    if (destroyed && card.id === marsBot.corp?.actionDeckBonusCard) {
      marsBot.setCorpState(ACTION_DECK_BONUS_CARD_REMOVED, 1);
    }
    // A card that returns to the action deck every generation waits outside the bonus deck
    if (!destroyed && !marsBot.returnsToActionDeck(card)) {
      marsBot.bonusDeck.discard(card);
    }
    return destroyed;
  }

  /**
   * Resolve a bonus card's effect.
   *
   * Returns true when the card must not be discarded: it was destroyed, or it went back into the bonus deck.
   */
  public resolveEffect(card: MarsBotBonusCard): boolean {
    return card.resolve(this.marsBot);
  }
}
