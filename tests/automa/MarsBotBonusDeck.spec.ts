import {expect} from 'chai';
import {MarsBotBonusDeck} from '../../src/server/automa/MarsBotBonusDeck';
import {SeededRandom} from '../../src/common/utils/Random';

describe('MarsBotBonusDeck', () => {
  let deck: MarsBotBonusDeck;

  beforeEach(() => {
    deck = MarsBotBonusDeck.createBase(new SeededRandom(42));
  });

  it('starts with 8 cards', () => {
    expect(deck.drawPile.length).to.eq(8);
    expect(deck.discardPile.length).to.eq(0);
  });

  it('draws a card', () => {
    const card = deck.draw();
    expect(card).to.not.be.undefined;
    expect(deck.drawPile.length).to.eq(7);
  });

  it('discards a card', () => {
    const card = deck.draw()!;
    deck.discard(card);
    expect(deck.discardPile.length).to.eq(1);
  });

  it('reshuffles discard when draw pile empty', () => {
    // Draw all 8 cards
    const cards = [];
    for (let i = 0; i < 8; i++) {
      cards.push(deck.draw()!);
    }
    expect(deck.drawPile.length).to.eq(0);

    // Discard all
    for (const c of cards) {
      deck.discard(c);
    }
    expect(deck.discardPile.length).to.eq(8);

    // Drawing should reshuffle
    const card = deck.draw();
    expect(card).to.not.be.undefined;
    expect(deck.discardPile.length).to.eq(0);
  });
});
