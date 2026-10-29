import {expect} from 'chai';
import {testGame} from '../TestGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {shuffleHiddenPiles} from '../../src/server/rewind/shuffleHiddenPiles';
import {SeededRandom} from '../../src/common/utils/Random';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';

describe('shuffleHiddenPiles in a MarsBot game', () => {
  let d: SerializedGame;
  let before: SerializedGame;

  beforeEach(() => {
    const [game] = testGame(1, {automa: true, automaDifficulty: 'easy', boardName: BoardName.THARSIS});
    d = game.serialize();
    before = structuredClone(d);
  });

  it('reorders MarsBot\'s action deck and bonus draw pile, and nothing else of MarsBot', () => {
    expect(before.automaState!.actionDeckCardNames.length).greaterThan(1);
    expect(before.automaState!.bonusDeckDrawPile.length).greaterThan(1);

    shuffleHiddenPiles(d, new SeededRandom(0.5));

    const state = d.automaState!;
    const was = before.automaState!;
    for (const [name, pile, old] of [
      ['action deck', state.actionDeckCardNames, was.actionDeckCardNames],
      ['bonus draw pile', state.bonusDeckDrawPile, was.bonusDeckDrawPile],
    ] as const) {
      expect(pile, name).has.members(old);
      expect(pile, name).not.deep.eq(old);
    }
    expect({...state, actionDeckCardNames: was.actionDeckCardNames, bonusDeckDrawPile: was.bonusDeckDrawPile}).deep.eq(was);
  });

  it('keeps Interface Hyperlink at the bottom of the bonus deck, where Tyco Magnetics puts it', () => {
    // The deck draws from the end of the draw pile, so the bottom card is the first one.
    d.automaState!.bonusDeckDrawPile.unshift(BonusCardId.B30_INTERFACE_HYPERLINK);
    const others = d.automaState!.bonusDeckDrawPile.slice(1);

    shuffleHiddenPiles(d, new SeededRandom(0.5));

    const pile = d.automaState!.bonusDeckDrawPile;
    expect(pile[0]).eq(BonusCardId.B30_INTERFACE_HYPERLINK);
    expect(pile.slice(1)).has.members(others);
    expect(pile.slice(1)).not.deep.eq(others);
  });
});
