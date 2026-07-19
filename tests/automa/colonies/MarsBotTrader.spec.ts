import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {selectTradeColony, tradeWithColony} from '../../../src/server/automa/colonies/MarsBotTrader';
import {COLONY_STORAGE_TAG} from '../../../src/server/automa/colonies/MarsBotShippingBoard';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {Luna} from '../../../src/server/colonies/Luna';
import {Europa} from '../../../src/server/colonies/Europa';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Titan} from '../../../src/server/colonies/Titan';
import {Pluto} from '../../../src/server/colonies/Pluto';
import {Tag} from '../../../src/common/cards/Tag';
import {BoardName} from '../../../src/common/boards/BoardName';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('MarsBotTrader (C-17, C-20, C-22, C-24b)', () => {
  describe('selectTradeColony', () => {
    it('returns undefined when no tradeable colonies', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = [];
      expect(selectTradeColony(game, marsBot)).to.be.undefined;
    });

    it('returns undefined when all colonies already visited (C-22)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.visitor = 'psome-player';
      game.colonies = [luna];
      expect(selectTradeColony(game, marsBot)).to.be.undefined;
    });

    it('selects the colony with the highest track position (C-17a)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 3;
      const ceres = new Ceres();
      ceres.trackPosition = 5;
      game.colonies = [luna, ceres];
      expect(selectTradeColony(game, marsBot)!.name).to.eq(ColonyName.CERES);
    });

    it('tiebreaks by preferring a colony where MarsBot has a presence (C-17b)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 4;
      const ceres = new Ceres();
      ceres.trackPosition = 4;
      ceres.colonies = [marsBot.player.id];
      game.colonies = [luna, ceres];
      expect(selectTradeColony(game, marsBot)!.name).to.eq(ColonyName.CERES);
    });

    it('uses random tiebreak (C-17c) when still tied after C-17a and C-17b', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 4;
      const ceres = new Ceres();
      ceres.trackPosition = 4;
      game.colonies = [luna, ceres];

      // Ensure there is at least one card in the project deck
      expect(game.projectDeck.drawPile.length).to.be.greaterThan(0);
      const discardBefore = game.projectDeck.discardPile.length;
      const result = selectTradeColony(game, marsBot);
      // Should have flipped one card (random tiebreak)
      expect(game.projectDeck.discardPile.length).to.eq(discardBefore + 1);
      expect(result).to.not.be.undefined;
    });

    it('excludes inactive colonies', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.isActive = false;
      game.colonies = [luna];
      expect(selectTradeColony(game, marsBot)).to.be.undefined;
    });
  });

  describe('tradeWithColony', () => {
    it('deducts 1 MC from marsBot (C-17d)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      const mcBefore = marsBot.turnResolver.mcSupply;
      tradeWithColony(marsBot, luna);
      expect(marsBot.turnResolver.mcSupply).to.eq(Math.max(0, mcBefore - 1));
    });

    it('marks colony.visitor with MarsBot player id (C-22)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      tradeWithColony(marsBot, luna);
      expect(luna.visitor).to.eq(marsBot.player.id);
    });

    it('gains 2 resources to shipping board (C-20)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      const storeBefore = marsBot.shippingBoard.get(ColonyName.LUNA);
      tradeWithColony(marsBot, luna);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storeBefore + 2);
    });

    it('gains 3 resources when MarsBot has a colony there (C-20)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.colonies = [marsBot.player.id];
      game.colonies = [luna];
      const storeBefore = marsBot.shippingBoard.get(ColonyName.LUNA);
      tradeWithColony(marsBot, luna);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storeBefore + 3);
    });

    it('resets track position to colonies.length after trade', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 5;
      luna.colonies = ['player1'];
      game.colonies = [luna];
      tradeWithColony(marsBot, luna);
      expect(luna.trackPosition).to.eq(luna.colonies.length);
    });

    describe('Europa special case (C-24b)', () => {
      it('raises TR 1 step instead of resources', () => {
        const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const europa = new Europa();
        game.colonies = [europa];
        const trBefore = marsBot.player.terraformRating;
        tradeWithColony(marsBot, europa);
        expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
      });

      it('does not add resources to Europa storage (C-24d)', () => {
        const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const europa = new Europa();
        game.colonies = [europa];
        tradeWithColony(marsBot, europa);
        expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0);
      });
    });

    describe('human colony bonus (C-20)', () => {
      it('gives colony bonus to human player when they have a colony on the tile', () => {
        const [game, player] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const ceres = new Ceres();
        // Put human player's ID on Ceres
        ceres.colonies = [player.id];
        game.colonies = [ceres];
        const steelBefore = player.steel;
        tradeWithColony(marsBot, ceres);
        // Ceres colony bonus = 1 steel
        expect(player.steel).to.be.greaterThan(steelBefore);
      });

      it('does not give MarsBot the printed colony bonus (skip self)', () => {
        const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const luna = new Luna();
        luna.colonies = [marsBot.player.id];
        game.colonies = [luna];
        // Only effect should be +3 to shipping board (not printed Luna bonus to MarsBot player)
        const storeBefore = marsBot.shippingBoard.get(ColonyName.LUNA);
        tradeWithColony(marsBot, luna);
        expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storeBefore + 3);
      });
    });

    it('Titan without Venus: adds resources to Titan storage (C-20, C-23)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      game.colonies = [titan];
      const storeBefore = marsBot.shippingBoard.get(ColonyName.TITAN);
      tradeWithColony(marsBot, titan);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(storeBefore + 2);
    });

    it('Titan with Venus Next: adds floaters instead of Titan storage (C-20, C-23)', () => {
      const [game] = testGame(1, {
        automaOption: true,
        coloniesExtension: true,
        venusNextExtension: true,
        boardName: BoardName.THARSIS,
      });
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      game.colonies = [titan];
      const floatersBefore = marsBot.floaterCount;
      const titanStoreBefore = marsBot.shippingBoard.get(ColonyName.TITAN);
      tradeWithColony(marsBot, titan);
      expect(marsBot.floaterCount).to.eq(floatersBefore + 2);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(titanStoreBefore); // Titan storage unchanged
    });

    describe('Pluto special case (C-26)', () => {
      it('adds 2 resources to Pluto storage (MC-equivalent) instead of drawing cards', () => {
        const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const pluto = new Pluto();
        game.colonies = [pluto];
        const storeBefore = marsBot.shippingBoard.get(ColonyName.PLUTO);
        tradeWithColony(marsBot, pluto);
        // 2 resources added to Pluto storage (not cards drawn)
        expect(marsBot.shippingBoard.get(ColonyName.PLUTO)).to.eq(storeBefore + 2);
      });

      it('Pluto storage maps to Event (MC) track via COLONY_STORAGE_TAG (C-26)', () => {
        // COLONY_STORAGE_TAG[PLUTO] = Tag.EVENT which corresponds to the credits/MC track
        expect(COLONY_STORAGE_TAG[ColonyName.PLUTO]).to.eq(Tag.EVENT);
      });

      it('Pluto overflow advances Event track (C-26, C-12)', () => {
        const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const pluto = new Pluto();
        game.colonies = [pluto];
        const eventTrackIdx = marsBot.board.getTrackIndexForTag(Tag.EVENT)!;
        const before = marsBot.board.tracks[eventTrackIdx].position;
        // Add 5 to Pluto → overflow → advance Event track
        marsBot.shippingBoard.add(ColonyName.PLUTO, 5, marsBot);
        expect(marsBot.board.tracks[eventTrackIdx].position).to.be.greaterThan(before);
        expect(marsBot.shippingBoard.get(ColonyName.PLUTO)).to.eq(0);
      });
    });
  });
});
