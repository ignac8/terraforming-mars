import {MarsBotBonusCard, bonusCard, createBaseBonusCards} from './MarsBotBonusCard';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {Random} from '../../common/utils/Random';
import {inplaceShuffle} from '../utils/shuffle';

/**
 * Manages the MarsBot bonus card deck.
 * Cards flow: drawPile → (played) → discardPile.
 * Destroyed cards are removed from the game entirely.
 */
export class MarsBotBonusDeck {
  public drawPile: Array<MarsBotBonusCard>;
  public discardPile: Array<MarsBotBonusCard> = [];

  constructor(
    cards: Array<MarsBotBonusCard>,
    private readonly random: Random,
  ) {
    this.drawPile = [...cards];
    inplaceShuffle(this.drawPile, this.random);
  }

  /** Create the base game bonus deck (B01–B08), shuffled. */
  public static createBase(random: Random): MarsBotBonusDeck {
    return new MarsBotBonusDeck(createBaseBonusCards(), random);
  }

  /** Create bonus deck with Venus Next: replace B06 (Lobbyists) with B15 (Lobbyists Venus). */
  public static createWithVenus(random: Random): MarsBotBonusDeck {
    const cards = createBaseBonusCards();
    const idx = cards.findIndex((c) => c.id === BonusCardId.B06_LOBBYISTS);
    if (idx >= 0) {
      cards[idx] = bonusCard(BonusCardId.B15_LOBBYISTS_VENUS, 'Lobbyists (Venus)');
    }
    return new MarsBotBonusDeck(cards, random);
  }

  /** Draw 1 bonus card. Reshuffles discard into draw pile if empty. */
  public draw(): MarsBotBonusCard | undefined {
    if (this.drawPile.length === 0) {
      this.reshuffleDiscard();
    }
    return this.drawPile.pop();
  }

  /** Place a resolved bonus card into the discard pile. */
  public discard(card: MarsBotBonusCard): void {
    if (!card.destroyed) {
      this.discardPile.push(card);
    }
    // Destroyed cards are simply not added anywhere.
  }

  /** Destroy a bonus card — remove it from the game permanently. */
  public destroy(card: MarsBotBonusCard): void {
    card.destroyed = true;
    // Remove from discard pile if present
    const idx = this.discardPile.indexOf(card);
    if (idx >= 0) {
      this.discardPile.splice(idx, 1);
    }
  }

  /** Find and remove a bonus card by ID from the draw pile. Returns the card or undefined. */
  public findAndRemove(bonusCardId: string): MarsBotBonusCard | undefined {
    const idx = this.drawPile.findIndex((c) => c.id === bonusCardId);
    if (idx >= 0) return this.drawPile.splice(idx, 1)[0];
    // Also check discard pile
    const discardIdx = this.discardPile.findIndex((c) => c.id === bonusCardId);
    if (discardIdx >= 0) return this.discardPile.splice(discardIdx, 1)[0];
    return undefined;
  }

  /** Remove a bonus card from the deck entirely by ID (does not return it). */
  public removeById(bonusCardId: string): void {
    this.drawPile = this.drawPile.filter((c) => c.id !== bonusCardId);
    this.discardPile = this.discardPile.filter((c) => c.id !== bonusCardId);
  }

  /** Shuffle the discard pile back into the draw pile (excluding destroyed cards). */
  private reshuffleDiscard(): void {
    const nonDestroyed = this.discardPile.filter((c) => !c.destroyed);
    this.discardPile = [];
    this.drawPile = nonDestroyed;
    inplaceShuffle(this.drawPile, this.random);
  }
}
