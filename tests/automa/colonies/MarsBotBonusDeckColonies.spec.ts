import {expect} from 'chai';
import {MarsBotBonusDeck} from '../../../src/server/automa/MarsBotBonusDeck';
import {BonusCardName} from '../../../src/common/automa/BonusCardName';
import {SeededRandom} from '../../../src/common/utils/Random';

describe('MarsBotBonusDeck — Colonies variants', () => {
  describe('create with Colonies', () => {
    let deck: MarsBotBonusDeck;
    beforeEach(() => {
      deck = MarsBotBonusDeck.create(new SeededRandom(0), {colonies: true});
    });

    it('has 9 cards (base 8 − B05 + B17 + B18)', () => {
      expect(deck.drawPile.length).to.eq(9);
    });

    it('does NOT contain base Expedited Construction (B05)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.not.include(BonusCardName.EXPEDITED_CONSTRUCTION);
    });

    it('contains Expedited Construction Colonies (B17)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.include(BonusCardName.EXPEDITED_CONSTRUCTION_COLONIES);
    });

    it('contains Outer System Foothold (B18)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.include(BonusCardName.OUTER_SYSTEM_FOOTHOLD);
    });

    it('does NOT contain Shipping Lines (B19) — set aside initially (rulebook C, p.4)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.not.include(BonusCardName.SHIPPING_LINES);
    });

    it('does NOT contain Extended Shipping Lines (B20) — set aside initially (rulebook C, p.4)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.not.include(BonusCardName.EXTENDED_SHIPPING_LINES);
    });

    it('still contains Lobbyists (B06, not Venus variant)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.include(BonusCardName.LOBBYISTS);
      expect(ids).to.not.include(BonusCardName.LOBBYISTS_VENUS);
    });
  });

  describe('create with Venus Next and Colonies', () => {
    let deck: MarsBotBonusDeck;
    beforeEach(() => {
      deck = MarsBotBonusDeck.create(new SeededRandom(0), {venus: true, colonies: true});
    });

    it('has 9 cards', () => {
      expect(deck.drawPile.length).to.eq(9);
    });

    it('does NOT contain base Expedited Construction (B05)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.not.include(BonusCardName.EXPEDITED_CONSTRUCTION);
    });

    it('does NOT contain base Lobbyists (B06) — replaced by Venus variant', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.not.include(BonusCardName.LOBBYISTS);
    });

    it('contains Expedited Construction Colonies (B17)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.include(BonusCardName.EXPEDITED_CONSTRUCTION_COLONIES);
    });

    it('contains Outer System Foothold (B18)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.include(BonusCardName.OUTER_SYSTEM_FOOTHOLD);
    });

    it('contains Lobbyists Venus (B15)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.include(BonusCardName.LOBBYISTS_VENUS);
    });

    it('does NOT contain Shipping Lines (B19) initially (rulebook C, p.4)', () => {
      const ids = deck.drawPile.map((c) => c.name);
      expect(ids).to.not.include(BonusCardName.SHIPPING_LINES);
    });
  });
});
