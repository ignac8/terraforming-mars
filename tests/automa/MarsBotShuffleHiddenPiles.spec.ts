import {expect} from 'chai';
import {testGame} from '../TestGame';
import {SerializedAutomaState, SerializedGame} from '../../src/server/SerializedGame';
import {shuffleHiddenPiles} from '../../src/server/rewind/shuffleHiddenPiles';
import {SeededRandom} from '../../src/common/utils/Random';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardName} from '../../src/common/automa/BonusCardName';
import {MarsBotBonusDeck} from '../../src/server/automa/MarsBotBonusDeck';
import {MarsBotBonusCard} from '../../src/server/automa/bonusCards/MarsBotBonusCard';
import {LEGACY_BONUS_CARD_IDS} from '../../src/server/automa/legacyBonusCards';

describe('shuffleHiddenPiles in a MarsBot game', () => {
  let bonusDeck: MarsBotBonusDeck;
  let d: SerializedGame;
  let before: SerializedGame;

  beforeEach(() => {
    const [game] = testGame(1, {automa: true, automaDifficulty: 'easy', boardName: BoardName.THARSIS});
    bonusDeck = game.automaHooks!.marsBot.bonusDeck;
    d = game.serialize();
    before = structuredClone(d);
  });

  it("reorders MarsBot's action deck and bonus draw pile, and nothing else of MarsBot", () => {
    expect(before.automaState!.actionDeckCardNames.length).greaterThan(1);
    expect(before.automaState!.bonusDeck.drawPile.length).greaterThan(1);

    shuffleHiddenPiles(d, new SeededRandom(0.5));

    const state = d.automaState!;
    const was = before.automaState!;
    for (const [name, pile, old] of [
      ['action deck', state.actionDeckCardNames, was.actionDeckCardNames],
      ['bonus draw pile', state.bonusDeck.drawPile, was.bonusDeck.drawPile],
    ] as const) {
      expect(pile, name).has.members(old);
      expect(pile, name).not.deep.eq(old);
    }
    const withPilesRestored = {
      ...state,
      actionDeckCardNames: was.actionDeckCardNames,
      bonusDeck: {...state.bonusDeck, drawPile: was.bonusDeck.drawPile},
    };
    expect(withPilesRestored).deep.eq(was);
  });

  it('keeps Interface Hyperlink at the bottom of the bonus deck, where Tyco Magnetics puts it', () => {
    // The deck draws from the end of the draw pile, so the bottom card is the first one.
    d.automaState!.bonusDeck.drawPile.unshift(BonusCardName.INTERFACE_HYPERLINK);
    const others = d.automaState!.bonusDeck.drawPile.slice(1);

    shuffleHiddenPiles(d, new SeededRandom(0.5));

    const pile = d.automaState!.bonusDeck.drawPile;
    expect(pile[0]).eq(BonusCardName.INTERFACE_HYPERLINK);
    expect(pile.slice(1)).has.members(others);
    expect(pile.slice(1)).not.deep.eq(others);
  });

  it('reorders the bonus draw pile of an older save, which holds bonus cards by id', () => {
    const state = d.automaState!;
    const drawPile = ['B30', ...bonusDeck.drawPile.map((c) => c instanceof MarsBotBonusCard ? LEGACY_BONUS_CARD_IDS[c.name] : c.name)];
    delete (state as Partial<SerializedAutomaState>).bonusDeck;
    state.bonusDeckDrawPile = [...drawPile];

    shuffleHiddenPiles(d, new SeededRandom(0.5));

    const pile = d.automaState!.bonusDeckDrawPile!;
    expect(pile[0]).eq('B30');
    expect(pile.slice(1)).has.members(drawPile.slice(1));
    expect(pile.slice(1)).not.deep.eq(drawPile.slice(1));
  });
});
