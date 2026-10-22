import {expect} from 'chai';
import {testGame} from '../TestGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {shuffleHiddenPiles} from '../../src/server/rewind/shuffleHiddenPiles';
import {SeededRandom} from '../../src/common/utils/Random';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';

type Pile = {
  get: (d: SerializedGame) => Array<unknown>;
  set: (d: SerializedGame, pile: Array<any>) => void;
};

const hiddenPiles: Array<[string, Pile]> = [
  ['projectDeck', {get: (d) => d.projectDeck.drawPile, set: (d, p) => d.projectDeck.drawPile = p}],
  ['corporationDeck', {get: (d) => d.corporationDeck.drawPile, set: (d, p) => d.corporationDeck.drawPile = p}],
  ['preludeDeck', {get: (d) => d.preludeDeck.drawPile, set: (d, p) => d.preludeDeck.drawPile = p}],
  ['ceoDeck', {get: (d) => d.ceoDeck.drawPile, set: (d, p) => d.ceoDeck.drawPile = p}],
  ['globalEventDealer', {
    get: (d) => d.turmoil!.globalEventDealer.deck,
    set: (d, p) => d.turmoil!.globalEventDealer.deck = p,
  }],
  ['underworld tokens', {get: (d) => d.underworldData.tokens, set: (d, p) => d.underworldData.tokens = p}],
  ['action deck', {get: (d) => d.automaState!.actionDeckCardNames, set: (d, p) => d.automaState!.actionDeckCardNames = p}],
  ['bonus deck', {get: (d) => d.automaState!.bonusDeckDrawPile, set: (d, p) => d.automaState!.bonusDeckDrawPile = p}],
];

describe('shuffleHiddenPiles', () => {
  let d: SerializedGame;
  let before: SerializedGame;

  beforeEach(() => {
    const [game] = testGame(1, {
      automaOption: true,
      boardName: BoardName.THARSIS,
      turmoilExtension: true,
      preludeExtension: true,
    });
    game.automaHooks!.marsBot.addBonusCardToBottomOfBonusDeck(BonusCardId.B30_INTERFACE_HYPERLINK);
    d = game.serialize();

    // A MarsBot game has neither CEOs nor Underworld, so take those piles from a solo game that has them.
    const [solo] = testGame(1, {ceoExtension: true, underworldExpansion: true});
    const soloState = solo.serialize();
    d.ceoDeck = soloState.ceoDeck;
    d.underworldData = soloState.underworldData;
    before = structuredClone(d);
  });

  it('reorders the hidden piles and nothing else', () => {
    shuffleHiddenPiles(d, new SeededRandom(0.5));

    for (const [name, pile] of hiddenPiles) {
      expect(pile.get(d), name).has.members(pile.get(before));
      expect(pile.get(d), name).not.deep.eq(pile.get(before));
    }
    expect(d.seed).not.eq(before.seed);
    expect(d.currentSeed).eq(Math.floor(d.seed * 4294967296));

    // Put the shuffled piles and both seeds back; everything else must be untouched.
    for (const [, pile] of hiddenPiles) {
      pile.set(d, pile.get(before) as Array<unknown>);
    }
    d.seed = before.seed;
    d.currentSeed = before.currentSeed;
    expect(d).deep.eq(before);
  });

  it('keeps Interface Hyperlink at the bottom of MarsBot\'s bonus deck', () => {
    expect(before.automaState!.bonusDeckDrawPile[0]).eq(BonusCardId.B30_INTERFACE_HYPERLINK);

    for (const seed of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      const copy = structuredClone(before);
      shuffleHiddenPiles(copy, new SeededRandom(seed));
      expect(copy.automaState!.bonusDeckDrawPile[0], String(seed)).eq(BonusCardId.B30_INTERFACE_HYPERLINK);
    }
  });
});
