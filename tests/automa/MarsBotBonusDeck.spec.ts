import {expect} from 'chai';
import {MarsBotBonusDeck} from '../../src/server/automa/MarsBotBonusDeck';
import {SeededRandom} from '../../src/common/utils/Random';
import {createBaseBonusCards, createBonusCard} from '../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';

describe('MarsBotBonusDeck', () => {
  const logger = {log: () => {}};
  let deck: MarsBotBonusDeck;

  beforeEach(() => {
    deck = MarsBotBonusDeck.create(new SeededRandom(42));
  });

  it('starts with the 8 base cards in the draw pile', () => {
    expect(deck.drawPile.length).to.eq(8);
    expect(deck.discardPile.length).to.eq(0);
  });

  it('createBonusCard creates a card with correct ID and name', () => {
    const card = createBonusCard(BonusCardId.B23_RAPID_SPROUTING);
    expect(card.id).to.eq(BonusCardId.B23_RAPID_SPROUTING);
    expect(card.name).to.eq(CardName.AUTOMA_RAPID_SPROUTING);
  });

  for (const run of [
    {
      expansions: 'Venus Next',
      venus: true,
      colonies: false,
      removed: [BonusCardId.B06_LOBBYISTS],
      added: [BonusCardId.B15_LOBBYISTS_VENUS],
    },
    {
      expansions: 'Colonies',
      venus: false,
      colonies: true,
      removed: [BonusCardId.B05_EXPEDITED_CONSTRUCTION],
      added: [BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES, BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD],
    },
    {
      expansions: 'Venus Next and Colonies',
      venus: true,
      colonies: true,
      removed: [BonusCardId.B05_EXPEDITED_CONSTRUCTION, BonusCardId.B06_LOBBYISTS],
      added: [
        BonusCardId.B15_LOBBYISTS_VENUS,
        BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES,
        BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD,
      ],
    },
  ]) {
    it('swaps cards in the ' + run.expansions + ' deck', () => {
      const expected = createBaseBonusCards()
        .map((card) => card.id)
        .filter((id) => !run.removed.includes(id))
        .concat(run.added);

      const expansionDeck = MarsBotBonusDeck.create(new SeededRandom(42), {venus: run.venus, colonies: run.colonies});

      expect(expansionDeck.drawPile.map((card) => card.id)).to.have.members(expected);
      expect(expansionDeck.discardPile).to.be.empty;
    });
  }

  it('serialization round trip', () => {
    deck.discard(deck.draw(logger)!, deck.draw(logger)!);
    const restored = MarsBotBonusDeck.deserialize(deck.serialize(), new SeededRandom(42));
    expect(restored.drawPile).to.deep.eq(deck.drawPile);
    expect(restored.discardPile).to.deep.eq(deck.discardPile);
  });

  it('serialization round trip with expansion and corporation bonus cards', () => {
    const ids = Object.values(BonusCardId).filter((id) => id >= BonusCardId.B15_LOBBYISTS_VENUS);
    const expansionDeck = new MarsBotBonusDeck(ids.map((id) => createBonusCard(id)), [], new SeededRandom(42));
    expansionDeck.discard(expansionDeck.draw(logger)!, expansionDeck.draw(logger)!);

    const restored = MarsBotBonusDeck.deserialize(expansionDeck.serialize(), new SeededRandom(42));

    expect(restored.drawPile).to.deep.eq(expansionDeck.drawPile);
    expect(restored.discardPile).to.deep.eq(expansionDeck.discardPile);
    expect([...restored.drawPile, ...restored.discardPile].map((card) => card.id)).to.have.members(ids);
  });

  it('serialization round trip with project cards', () => {
    const expansionDeck = MarsBotBonusDeck.create(new SeededRandom(42), {venus: true, colonies: true});
    expansionDeck.drawPile.unshift(createBonusCard(BonusCardId.B30_INTERFACE_HYPERLINK));
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
