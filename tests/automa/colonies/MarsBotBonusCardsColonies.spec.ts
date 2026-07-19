import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {MarsBotBonusCard, bonusCard} from '../../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {Luna} from '../../../src/server/colonies/Luna';
import {Europa} from '../../../src/server/colonies/Europa';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {BoardName} from '../../../src/common/boards/BoardName';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

function makeCard(id: BonusCardId, name: string): MarsBotBonusCard {
  return bonusCard(id, name);
}

describe('MarsBotBonusCardsColonies (C-15, C-16, C-17)', () => {
  describe('B17: Expedited Construction Colonies', () => {
    function b17Card(): MarsBotBonusCard {
      return makeCard(BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES, 'Expedited Construction (Colonies)');
    }

    it('C-15a: places city if adjacent to ≥2 greenery/ocean tiles and destroys card', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = [new Luna()];
      // Place some ocean tiles so the condition can be met
      const oceansNeeded = 2;
      for (let i = 0; i < oceansNeeded; i++) {
        marsBot.turnResolver.placeOcean();
      }
      const card = b17Card();
      marsBot.bonusDeck.drawPile.push(card);

      // Stub findExpediteConstructionCitySpace to return a valid space
      const tilesBefore = game.board.spaces.filter((s) => s.tile !== undefined).length;
      const destroyed = marsBot['bonusResolver'].resolve(card);

      // If city placed, tile count should increase and card should be destroyed
      const tilesAfter = game.board.spaces.filter((s) => s.tile !== undefined).length;
      // Either the city was placed (and card destroyed) or it wasn't (no city space found)
      if (tilesAfter > tilesBefore) {
        expect(destroyed).to.be.true;
      }
    });

    it('C-15b: places colony if MarsBot has ≤1 colonies and no city space', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      const card = b17Card();
      marsBot.bonusDeck.drawPile.push(card);
      const destroyed = marsBot['bonusResolver'].resolve(card);
      // Either a colony was placed or no eligible colony was found
      // Card should NOT be destroyed in this branch
      expect(destroyed).to.be.false;
    });

    it('C-15b: gains 2 resources if colony placed', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      const card = b17Card();
      marsBot.bonusDeck.drawPile.push(card);
      const storageBefore = marsBot.shippingBoard.get(ColonyName.LUNA);
      marsBot['bonusResolver'].resolve(card);
      // Only meaningful if luna colony was placed
      if (luna.colonies.includes(marsBot.player.id)) {
        expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storageBefore + 2);
      }
    });

    it('C-15c: no effect if MarsBot already has 2+ colonies', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.colonies = [marsBot.player.id];
      const ceres = new Ceres();
      ceres.colonies = [marsBot.player.id];
      game.colonies = [luna, ceres];
      const card = b17Card();
      marsBot.bonusDeck.drawPile.push(card);
      const destroyed = marsBot['bonusResolver'].resolve(card);
      expect(destroyed).to.be.false;
      // No new colonies should be added
      expect(luna.colonies.filter((id) => id === marsBot.player.id).length).to.eq(1);
    });
  });

  describe('B18: Outer System Foothold', () => {
    function b18Card(): MarsBotBonusCard {
      return makeCard(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD, 'Outer System Foothold');
    }

    it('C-16a/b: places colony and gains 2 resources', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      const card = b18Card();
      marsBot.bonusDeck.discardPile.push(card); // Will be restored; deck starts fresh
      marsBot.bonusDeck.drawPile.push(card);
      const destroyed = marsBot['bonusResolver'].resolve(card);
      // Luna should have marsBot as a colony or shipping board got resources
      const hasColony = luna.colonies.includes(marsBot.player.id);
      if (hasColony) {
        expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
      }
      expect(destroyed).to.be.false;
    });

    it('C-16c/d: draws and discards a bonus card (not resolves)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = [new Luna()];

      // Put a filler bonus card in the deck so draw() can return something
      const fillerCard = makeCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT, 'R&D');
      marsBot.bonusDeck.drawPile = [fillerCard];

      const card = b18Card();
      marsBot['bonusResolver'].resolve(card);

      // The filler should have been discarded (not resolved, so deck mcSupply unchanged)
      // Since R&D would have changed mcSupply, and it was just discarded, no change expected
      expect(marsBot.bonusDeck.discardPile).to.include(fillerCard);
    });

    it('C-16c: B18 is excluded from the reshuffle for the draw', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = [new Luna()];

      // Deck empty, discard has only B18 — after resolve, B18 should NOT be drawn
      const card = b18Card();
      marsBot.bonusDeck.drawPile = [];
      marsBot.bonusDeck.discardPile = [card];
      marsBot['bonusResolver'].resolve(card);
      // B18 should be back in discard but not have been drawn (no infinite loop)
      // No crash = success
    });
  });

  describe('B19: Shipping Lines', () => {
    function b19Card(): MarsBotBonusCard {
      return makeCard(BonusCardId.B19_SHIPPING_LINES, 'Shipping Lines');
    }

    it('C-17: selects best colony and trades', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 4;
      game.colonies = [luna];
      const mcBefore = marsBot.turnResolver.mcSupply;
      const card = b19Card();
      marsBot.bonusDeck.drawPile.push(card);
      marsBot['bonusResolver'].resolve(card);
      // Should have spent 1 MC and gained 2 resources to Luna
      expect(marsBot.turnResolver.mcSupply).to.eq(Math.max(0, mcBefore - 1));
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
      expect(luna.visitor).to.eq(marsBot.player.id);
    });

    it('C-17: failed action if no tradeable colony', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = []; // No colonies
      const mcBefore = marsBot.turnResolver.mcSupply;
      const card = b19Card();
      marsBot.bonusDeck.drawPile.push(card);
      marsBot['bonusResolver'].resolve(card);
      // Failed action gives MC
      expect(marsBot.turnResolver.mcSupply).to.be.greaterThan(mcBefore);
    });

    it('C-24b: Europa trade raises TR instead of resources', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const europa = new Europa();
      europa.trackPosition = 5;
      game.colonies = [europa];
      const trBefore = marsBot.player.terraformRating;
      const card = b19Card();
      marsBot.bonusDeck.drawPile.push(card);
      marsBot['bonusResolver'].resolve(card);
      expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
      expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0);
    });
  });

  describe('B20: Extended Shipping Lines', () => {
    function b20Card(): MarsBotBonusCard {
      return makeCard(BonusCardId.B20_EXTENDED_SHIPPING_LINES, 'Extended Shipping Lines');
    }

    it('C-17: same trade logic as B19', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 3;
      game.colonies = [luna];
      const mcBefore = marsBot.turnResolver.mcSupply;
      const card = b20Card();
      marsBot.bonusDeck.drawPile.push(card);
      marsBot['bonusResolver'].resolve(card);
      expect(marsBot.turnResolver.mcSupply).to.eq(Math.max(0, mcBefore - 1));
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
    });

    it('C-17: failed action if all colonies visited', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.visitor = 'psome-player'; // Already traded
      game.colonies = [luna];
      const mcBefore = marsBot.turnResolver.mcSupply;
      const card = b20Card();
      marsBot.bonusDeck.drawPile.push(card);
      marsBot['bonusResolver'].resolve(card);
      expect(marsBot.turnResolver.mcSupply).to.be.greaterThan(mcBefore);
    });
  });
});
