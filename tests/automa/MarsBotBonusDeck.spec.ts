import {expect} from 'chai';
import {MarsBotBonusDeck} from '../../src/server/automa/MarsBotBonusDeck';
import {SeededRandom} from '../../src/common/utils/Random';
import {createCorpBonusCard} from '../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';

describe('MarsBotBonusDeck', () => {
  const logger = {log: () => {}};
  let deck: MarsBotBonusDeck;

  beforeEach(() => {
    deck = MarsBotBonusDeck.createBase(new SeededRandom(42));
  });

  it('starts with the 8 base cards in the draw pile', () => {
    expect(deck.drawPile.length).to.eq(8);
    expect(deck.discardPile.length).to.eq(0);
  });

  it('serialization round trip', () => {
    deck.discard(deck.draw(logger)!, deck.draw(logger)!);
    const restored = MarsBotBonusDeck.deserialize(deck.serialize(), new SeededRandom(42));
    expect(restored.drawPile).to.deep.eq(deck.drawPile);
    expect(restored.discardPile).to.deep.eq(deck.discardPile);
  });

  it('serialization round trip with expansion and corporation bonus cards, and project cards', () => {
    const expansionDeck = MarsBotBonusDeck.createWithVenusAndColonies(new SeededRandom(42));
    expansionDeck.drawPile.unshift(createCorpBonusCard(BonusCardId.B30_INTERFACE_HYPERLINK));
    expansionDeck.drawPile.push(new Asteroid());
    expansionDeck.discard(expansionDeck.draw(logger)!, expansionDeck.draw(logger)!, new Tardigrades());

    const restored = MarsBotBonusDeck.deserialize(expansionDeck.serialize(), new SeededRandom(42));

    expect(restored.drawPile).to.deep.eq(expansionDeck.drawPile);
    expect(restored.discardPile).to.deep.eq(expansionDeck.discardPile);
  });

  it('draws a card', () => {
    const card = deck.draw(logger);
    expect(card).to.not.be.undefined;
    expect(deck.drawPile.length).to.eq(7);
  });

  it('discards a card', () => {
    const card = deck.draw(logger)!;
    deck.discard(card);
    expect(deck.discardPile.length).to.eq(1);
  });

  // Nick: reshuffle when a draw finds the deck empty (BGG 3387297), by which time the last card is discarded too.
  it('the last card drawn joins the next reshuffle', () => {
    for (let i = 0; i < 7; i++) {
      deck.discard(deck.draw(logger)!);
    }
    const last = deck.draw(logger)!;
    expect(deck.drawPile).is.empty;
    expect(deck.discardPile.length).to.eq(7);

    deck.discard(last);
    deck.draw(logger);
    expect(deck.drawPile.length).to.eq(7);
    expect(deck.discardPile).is.empty;
  });

  it('reshuffles discard when draw pile empty', () => {
    // Draw all 8 cards
    const cards = [];
    for (let i = 0; i < 8; i++) {
      cards.push(deck.draw(logger)!);
    }
    expect(deck.drawPile.length).to.eq(0);

    // Discard all
    for (const c of cards) {
      deck.discard(c);
    }
    expect(deck.discardPile.length).to.eq(8);

    // Drawing should reshuffle
    const card = deck.draw(logger);
    expect(card).to.not.be.undefined;
    expect(deck.discardPile.length).to.eq(0);
  });
});
