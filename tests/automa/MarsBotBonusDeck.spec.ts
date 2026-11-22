import {expect} from 'chai';
import {BASE_BONUS_CARDS, MarsBotBonusDeck} from '../../src/server/automa/MarsBotBonusDeck';
import {SeededRandom} from '../../src/common/utils/Random';
import {createBonusCard} from '../../src/server/automa/bonusCards/MarsBotBonusCards';
import {BonusCardName} from '../../src/common/automa/BonusCardName';
import {MarsBotBonusCard} from '../../src/server/automa/bonusCards/MarsBotBonusCard';
import {MeteorShower} from '../../src/server/automa/bonusCards/MeteorShower';
import {testGame} from '../TestGame';
import {recordingMarsBot} from './corps/RecordingMarsBot';
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

  for (const run of [
    {
      expansions: 'Venus Next',
      venus: true,
      colonies: false,
      expected: {
        removed: [BonusCardName.LOBBYISTS],
        added: [BonusCardName.LOBBYISTS_VENUS],
      },
    },
    {
      expansions: 'Colonies',
      venus: false,
      colonies: true,
      expected: {
        removed: [BonusCardName.EXPEDITED_CONSTRUCTION],
        added: [BonusCardName.EXPEDITED_CONSTRUCTION_COLONIES, BonusCardName.OUTER_SYSTEM_FOOTHOLD],
      },
    },
    {
      expansions: 'Venus Next and Colonies',
      venus: true,
      colonies: true,
      expected: {
        removed: [BonusCardName.EXPEDITED_CONSTRUCTION, BonusCardName.LOBBYISTS],
        added: [
          BonusCardName.LOBBYISTS_VENUS,
          BonusCardName.EXPEDITED_CONSTRUCTION_COLONIES,
          BonusCardName.OUTER_SYSTEM_FOOTHOLD,
        ],
      },
    },
  ]) {
    it('swaps cards in the ' + run.expansions + ' deck', () => {
      const expected = BASE_BONUS_CARDS
        .filter((name) => !run.expected.removed.some((removed) => removed === name))
        .concat(run.expected.added);

      const expansionDeck = MarsBotBonusDeck.create(new SeededRandom(42), {venus: run.venus, colonies: run.colonies});

      expect(expansionDeck.drawPile.map((card) => card.name)).to.have.members(expected);
      expect(expansionDeck.discardPile).to.be.empty;
    });
  }

  it('a drawn card resolves through its own class', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
    human.plants = 4;
    const drawPile = MarsBotBonusDeck.create(new SeededRandom(42)).drawPile;
    const meteorShower = drawPile.find((card): card is MarsBotBonusCard => card.name === BonusCardName.METEOR_SHOWER);

    const destroyed = meteorShower?.resolve(marsBot);

    expect(meteorShower).instanceOf(MeteorShower);
    expect(human.plants).eq(0);
    expect(destroyed).is.true;
  });

  it('serialization round trip', () => {
    deck.discard(deck.draw(logger)!, deck.draw(logger)!);
    const restored = MarsBotBonusDeck.deserialize(deck.serialize(), new SeededRandom(42));
    expect(restored.drawPile).to.deep.eq(deck.drawPile);
    expect(restored.discardPile).to.deep.eq(deck.discardPile);
    const restoredDrawClasses = restored.drawPile.map((card) => card.constructor);
    const restoredDiscardClasses = restored.discardPile.map((card) => card.constructor);
    expect(restoredDrawClasses).deep.eq(deck.drawPile.map((card) => card.constructor));
    expect(restoredDiscardClasses).deep.eq(deck.discardPile.map((card) => card.constructor));
  });

  it('serialization round trip with expansion and corporation bonus cards', () => {
    const names = [
      BonusCardName.LOBBYISTS_VENUS,
      BonusCardName.GOVERNMENT_INTERVENTION,
      BonusCardName.EXPEDITED_CONSTRUCTION_COLONIES,
      BonusCardName.OUTER_SYSTEM_FOOTHOLD,
      BonusCardName.SHIPPING_LINES,
      BonusCardName.EXTENDED_SHIPPING_LINES,
      BonusCardName.PARTY_POLITICS,
      BonusCardName.SETTLERS,
      BonusCardName.RAPID_SPROUTING,
      BonusCardName.SUPPLY_AND_DEMAND,
      BonusCardName.DO_IT_RIGHT,
      BonusCardName.VENUSIAN_LOBBY,
      BonusCardName.BUILD_BUILD_BUILD,
      BonusCardName.DIVERSIFICATION,
      BonusCardName.GRAY_EMINENCE,
      BonusCardName.INTERFACE_HYPERLINK,
      BonusCardName.GOVERNMENT_SUBSIDY,
      BonusCardName.INVESTORS,
    ];
    const expansionDeck = new MarsBotBonusDeck(names.map(createBonusCard), [], new SeededRandom(42));
    expansionDeck.discard(expansionDeck.draw(logger)!, expansionDeck.draw(logger)!);

    const restored = MarsBotBonusDeck.deserialize(expansionDeck.serialize(), new SeededRandom(42));

    expect(restored.drawPile).to.deep.eq(expansionDeck.drawPile);
    expect(restored.discardPile).to.deep.eq(expansionDeck.discardPile);
    expect([...restored.drawPile, ...restored.discardPile].map((card) => card.name)).to.have.members(names);
  });

  it('serialization round trip with project cards', () => {
    const expansionDeck = MarsBotBonusDeck.create(new SeededRandom(42), {venus: true, colonies: true});
    expansionDeck.drawPile.unshift(createBonusCard(BonusCardName.INTERFACE_HYPERLINK));
    expansionDeck.drawPile.push(new Asteroid());
    expansionDeck.discard(expansionDeck.draw(logger)!, expansionDeck.draw(logger)!, new Tardigrades());

    const restored = MarsBotBonusDeck.deserialize(expansionDeck.serialize(), new SeededRandom(42));

    expect(restored.drawPile).to.deep.eq(expansionDeck.drawPile);
    expect(restored.discardPile).to.deep.eq(expansionDeck.discardPile);
  });

  for (const name of Object.values(BonusCardName)) {
    it('createBonusCard creates the card of its name: ' + name, () => {
      expect(createBonusCard(name).name).to.eq(name);
    });
  }

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
    const cards = [];
    for (let i = 0; i < 8; i++) {
      cards.push(deck.draw(logger)!);
    }
    expect(deck.drawPile.length).to.eq(0);

    for (const c of cards) {
      deck.discard(c);
    }
    expect(deck.discardPile.length).to.eq(8);

    const card = deck.draw(logger);
    expect(card).to.not.be.undefined;
    expect(deck.discardPile.length).to.eq(0);
  });
});
