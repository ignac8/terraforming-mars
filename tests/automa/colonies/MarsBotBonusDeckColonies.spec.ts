import {expect} from 'chai';
import {MarsBotBonusDeck} from '../../../src/server/automa/MarsBotBonusDeck';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {SeededRandom} from '../../../src/common/utils/Random';

describe('MarsBotBonusDeck — Colonies variants', () => {
  describe('createWithColonies (C-2, C-3)', () => {
    let deck: MarsBotBonusDeck;
    beforeEach(() => {
      deck = MarsBotBonusDeck.createWithColonies(new SeededRandom(0));
    });

    it('has 9 cards (base 8 − B05 + B17 + B18)', () => {
      expect(deck.drawPile.length).to.eq(9);
    });

    it('does NOT contain base Expedited Construction (B05)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.not.include(BonusCardId.B05_EXPEDITED_CONSTRUCTION);
    });

    it('contains Expedited Construction Colonies (B17)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.include(BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES);
    });

    it('contains Outer System Foothold (B18)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.include(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
    });

    it('does NOT contain Shipping Lines (B19) — set aside initially (C-7)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.not.include(BonusCardId.B19_SHIPPING_LINES);
    });

    it('does NOT contain Extended Shipping Lines (B20) — set aside initially (C-7)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.not.include(BonusCardId.B20_EXTENDED_SHIPPING_LINES);
    });

    it('still contains Lobbyists (B06, not Venus variant)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.include(BonusCardId.B06_LOBBYISTS);
      expect(ids).to.not.include(BonusCardId.B15_LOBBYISTS_VENUS);
    });
  });

  describe('createWithVenusAndColonies (C-2, C-3 + Venus)', () => {
    let deck: MarsBotBonusDeck;
    beforeEach(() => {
      deck = MarsBotBonusDeck.createWithVenusAndColonies(new SeededRandom(0));
    });

    it('has 9 cards', () => {
      expect(deck.drawPile.length).to.eq(9);
    });

    it('does NOT contain base Expedited Construction (B05)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.not.include(BonusCardId.B05_EXPEDITED_CONSTRUCTION);
    });

    it('does NOT contain base Lobbyists (B06) — replaced by Venus variant', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.not.include(BonusCardId.B06_LOBBYISTS);
    });

    it('contains Expedited Construction Colonies (B17)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.include(BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES);
    });

    it('contains Outer System Foothold (B18)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.include(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
    });

    it('contains Lobbyists Venus (B15)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.include(BonusCardId.B15_LOBBYISTS_VENUS);
    });

    it('does NOT contain Shipping Lines (B19) initially (C-7)', () => {
      const ids = deck.drawPile.map((c) => c.id);
      expect(ids).to.not.include(BonusCardId.B19_SHIPPING_LINES);
    });
  });
});
