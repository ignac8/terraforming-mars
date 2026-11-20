import {expect} from 'chai';
import {testGame} from '../TestGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {shuffleHiddenPiles} from '../../src/server/rewind/shuffleHiddenPiles';
import {SeededRandom} from '../../src/common/utils/Random';
import {BoardName} from '../../src/common/boards/BoardName';

type Pile = {
  get: (d: SerializedGame) => Array<unknown>;
  set: (d: SerializedGame, pile: Array<unknown>) => void;
};

function pileOf<T>(get: (d: SerializedGame) => Array<T>, set: (d: SerializedGame, pile: Array<T>) => void): Pile {
  return {get, set: (d, pile) => set(d, pile as Array<T>)};
}

const hiddenPiles: Array<[string, Pile]> = [
  ['projectDeck', pileOf((d) => d.projectDeck.drawPile, (d, p) => d.projectDeck.drawPile = p)],
  ['corporationDeck', pileOf((d) => d.corporationDeck.drawPile, (d, p) => d.corporationDeck.drawPile = p)],
  ['preludeDeck', pileOf((d) => d.preludeDeck.drawPile, (d, p) => d.preludeDeck.drawPile = p)],
  ['ceoDeck', pileOf((d) => d.ceoDeck.drawPile, (d, p) => d.ceoDeck.drawPile = p)],
  ['globalEventDealer', pileOf(
    (d) => d.turmoil!.globalEventDealer.deck,
    (d, p) => d.turmoil!.globalEventDealer.deck = p,
  )],
  ['underworld tokens', pileOf((d) => d.underworldData.tokens, (d, p) => d.underworldData.tokens = p)],
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
    // The game continues on a fresh, strong (sfc32) generator; the legacy seed fields are cleared.
    expect(d.rng).not.deep.eq(before.rng);
    expect(d.rng?.kind).eq('sfc32');
    expect(d.seed).eq(undefined);
    expect(d.currentSeed).eq(undefined);

    // Put the shuffled piles and the generator back; everything else must be untouched.
    for (const [, pile] of hiddenPiles) {
      pile.set(d, pile.get(before) as Array<unknown>);
    }
    d.rng = before.rng;
    expect(d).deep.eq(before);
  });
});
