import {expect} from 'chai';
import {testGame} from '../TestGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {shuffleHiddenPiles} from '../../src/server/rewind/shuffleHiddenPiles';
import {SeededRandom} from '../../src/common/utils/Random';
import {BoardName} from '../../src/common/boards/BoardName';

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
];

describe('shuffleHiddenPiles', () => {
  let d: SerializedGame;
  let before: SerializedGame;

  beforeEach(() => {
    const [game] = testGame(1, {
      boardName: BoardName.THARSIS,
      turmoilExtension: true,
      preludeExtension: true,
      ceoExtension: true,
      underworldExpansion: true,
    });
    d = game.serialize();
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
});
