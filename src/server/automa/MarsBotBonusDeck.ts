import {MarsBotBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCard';
import {createBonusCard, isBonusCardName} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {CardName} from '@/common/cards/CardName';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {newProjectCard} from '@/server/createCard';
import {Deck} from '../cards/Deck';
import {SerializedDeck} from '../cards/SerializedDeck';
import {Random} from '../../common/utils/Random';
import {inplaceRemove} from '../../common/utils/utils';

/** The bonus cards in the base game deck (B01-B08), before any expansion swaps some out. */
export const BASE_BONUS_CARDS: ReadonlyArray<BonusCardName> = [
  BonusCardName.METEOR_SHOWER,
  BonusCardName.INVASIVE_SPECIES,
  BonusCardName.RESEARCH_AND_DEVELOPMENT,
  BonusCardName.OVERACHIEVEMENT,
  BonusCardName.EXPEDITED_CONSTRUCTION,
  BonusCardName.LOBBYISTS,
  BonusCardName.LOCAL_NEURAL_INSTANCE,
  BonusCardName.CORPORATE_COMPETITION,
];

/**
 * A card in MarsBot's bonus deck: a bonus card, or a project card a corporation put there.
 *
 * MarsBot plays a project card drawn from the bonus deck like one from its action deck.
 */
export type MarsBotBonusDeckCard = MarsBotBonusCard | IProjectCard;

/** Creates a bonus deck card from its saved name: a bonus card, or else a project card. */
function deserializeCard(name: BonusCardName | CardName): MarsBotBonusDeckCard {
  if (isBonusCardName(name)) {
    return createBonusCard(name);
  }
  const card = newProjectCard(name);
  if (card === undefined) {
    throw new Error(`Cannot restore MarsBot bonus deck card ${name}`);
  }
  return card;
}

/** The MarsBot bonus card deck. */
export class MarsBotBonusDeck extends Deck<MarsBotBonusDeckCard, BonusCardName | CardName> {
  public constructor(deck: Array<MarsBotBonusDeckCard>, discarded: Array<MarsBotBonusDeckCard>, random: Random) {
    super('marsbot', deck, discarded, random);
  }

  /**
   * Creates the bonus deck for the expansions in play, shuffled.
   *
   * Venus Next replaces B06 (Lobbyists) with B15 (Lobbyists Venus). Colonies replaces B05
   * (Expedited Construction) with B17 (Expedited Construction Colonies) and adds B18 (Outer System
   * Foothold); B19/B20 are set aside and injected into the action deck each generation (rulebook C, p.4).
   */
  public static create(random: Random, expansions: {venus?: boolean, colonies?: boolean} = {}): MarsBotBonusDeck {
    const cards = BASE_BONUS_CARDS.map(createBonusCard);
    const replace = (name: BonusCardName, withName: BonusCardName) => {
      cards[cards.findIndex((c) => c.name === name)] = createBonusCard(withName);
    };
    if (expansions.venus) {
      replace(BonusCardName.LOBBYISTS, BonusCardName.LOBBYISTS_VENUS);
    }
    if (expansions.colonies) {
      replace(BonusCardName.EXPEDITED_CONSTRUCTION, BonusCardName.EXPEDITED_CONSTRUCTION_COLONIES);
      cards.push(createBonusCard(BonusCardName.OUTER_SYSTEM_FOOTHOLD));
    }
    const deck = new MarsBotBonusDeck(cards, [], random);
    deck.shuffle();
    return deck;
  }

  public static deserialize(d: SerializedDeck<BonusCardName | CardName>, random: Random): MarsBotBonusDeck {
    const deck = d.drawPile.map(deserializeCard);
    const discarded = d.discardPile.map(deserializeCard);
    return new MarsBotBonusDeck(deck, discarded, random);
  }

  /**
   * Removes the bonus card `bonusCardName` from the draw pile, or else the discard pile.
   *
   * Returns the card, or undefined when neither pile holds it.
   */
  public findAndRemove(bonusCardName: BonusCardName): MarsBotBonusCard | undefined {
    for (const pile of [this.drawPile, this.discardPile]) {
      const card = pile.find((c): c is MarsBotBonusCard => c instanceof MarsBotBonusCard && c.name === bonusCardName);
      if (card !== undefined) {
        inplaceRemove(pile, card);
        return card;
      }
    }
    return undefined;
  }

  /** Removes the bonus card `bonusCardName` from both piles. */
  public removeByName(bonusCardName: BonusCardName): void {
    this.drawPile = this.drawPile.filter((c) => c.name !== bonusCardName);
    this.discardPile = this.discardPile.filter((c) => c.name !== bonusCardName);
  }
}
