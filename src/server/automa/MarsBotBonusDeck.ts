import {MarsBotBonusCard, bonusCard, createBaseBonusCards} from './MarsBotBonusCard';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {Random} from '../../common/utils/Random';
import {inplaceShuffle} from '../utils/shuffle';

/**
 * Manages the MarsBot bonus card deck.
 * Cards flow: drawPile → (played) → discardPile.
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

  /**
   * Create bonus deck with Colonies (C-2, C-3):
   * Replace B05 (Expedited Construction) with B17 (Expedited Construction Colonies).
   * Add B18 (Outer System Foothold) to the deck.
   * B19/B20 are set aside and injected into the action deck each generation (C-10/C-11).
   */
  public static createWithColonies(random: Random): MarsBotBonusDeck {
    const cards = createBaseBonusCards();
    const idx = cards.findIndex((c) => c.id === BonusCardId.B05_EXPEDITED_CONSTRUCTION);
    if (idx >= 0) {
      cards[idx] = bonusCard(BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES, 'Expedited Construction (Colonies)');
    }
    cards.push(bonusCard(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD, 'Outer System Foothold'));
    return new MarsBotBonusDeck(cards, random);
  }

  /**
   * Create bonus deck with both Venus Next and Colonies:
   * Replace B05 with B17 (Colonies), replace B06 with B15 (Venus), add B18.
   */
  public static createWithVenusAndColonies(random: Random): MarsBotBonusDeck {
    const cards = createBaseBonusCards();
    const b05Idx = cards.findIndex((c) => c.id === BonusCardId.B05_EXPEDITED_CONSTRUCTION);
    if (b05Idx >= 0) {
      cards[b05Idx] = bonusCard(BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES, 'Expedited Construction (Colonies)');
    }
    const b06Idx = cards.findIndex((c) => c.id === BonusCardId.B06_LOBBYISTS);
    if (b06Idx >= 0) {
      cards[b06Idx] = bonusCard(BonusCardId.B15_LOBBYISTS_VENUS, 'Lobbyists (Venus)');
    }
    cards.push(bonusCard(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD, 'Outer System Foothold'));
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
    this.discardPile.push(card);
  }

  /** Find and remove a bonus card by ID from the draw pile. Returns the card or undefined. */
  public findAndRemove(bonusCardId: string): MarsBotBonusCard | undefined {
    const idx = this.drawPile.findIndex((c) => c.id === bonusCardId);
    if (idx >= 0) {
      return this.drawPile.splice(idx, 1)[0];
    }
    // Also check discard pile
    const discardIdx = this.discardPile.findIndex((c) => c.id === bonusCardId);
    if (discardIdx >= 0) {
      return this.discardPile.splice(discardIdx, 1)[0];
    }
    return undefined;
  }

  /** Remove a bonus card from the deck entirely by ID (does not return it). */
  public removeById(bonusCardId: string): void {
    this.drawPile = this.drawPile.filter((c) => c.id !== bonusCardId);
    this.discardPile = this.discardPile.filter((c) => c.id !== bonusCardId);
  }

  /** Shuffle the discard pile back into the draw pile. */
  private reshuffleDiscard(): void {
    this.drawPile = this.discardPile;
    this.discardPile = [];
    inplaceShuffle(this.drawPile, this.random);
  }
}
