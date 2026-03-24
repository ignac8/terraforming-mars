import {MarsBotBonusCard, createBaseBonusCards} from './MarsBotBonusCard';
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

  /** Shuffle the discard pile back into the draw pile (excluding destroyed cards). */
  private reshuffleDiscard(): void {
    const nonDestroyed = this.discardPile.filter((c) => !c.destroyed);
    this.discardPile = [];
    this.drawPile = nonDestroyed;
    inplaceShuffle(this.drawPile, this.random);
  }
}
