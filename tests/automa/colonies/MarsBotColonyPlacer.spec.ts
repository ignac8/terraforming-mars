import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {
  selectRandomColony,
  placeColonyForMarsBot,
  eligibleColoniesForMarsBot,
} from '../../../src/server/automa/colonies/MarsBotColonyPlacer';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {Luna} from '../../../src/server/colonies/Luna';
import {Europa} from '../../../src/server/colonies/Europa';
import {Titan} from '../../../src/server/colonies/Titan';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {BoardName} from '../../../src/common/boards/BoardName';
import {Tag} from '../../../src/common/cards/Tag';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('MarsBotColonyPlacer (C-15b, C-16a, C-19, C-24a)', () => {
  describe('eligibleColoniesForMarsBot', () => {
    it('excludes inactive colonies', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.isActive = false;
      game.colonies = [luna];
      const eligible = eligibleColoniesForMarsBot(game, marsBot);
      expect(eligible.length).to.eq(0);
    });

    it('excludes full colonies', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.colonies = ['p1', 'p2', 'p3']; // MAX_COLONIES_PER_TILE = 3
      game.colonies = [luna];
      const eligible = eligibleColoniesForMarsBot(game, marsBot);
      expect(eligible.length).to.eq(0);
    });

    it('excludes colonies where MarsBot already has one', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.colonies = [marsBot.player.id];
      game.colonies = [luna];
      const eligible = eligibleColoniesForMarsBot(game, marsBot);
      expect(eligible.length).to.eq(0);
    });

    it('includes active, non-full colonies without MarsBot', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      const eligible = eligibleColoniesForMarsBot(game, marsBot);
      expect(eligible.length).to.eq(1);
    });
  });

  describe('selectRandomColony (C-15b method)', () => {
    it('uses card cost to index into eligible colonies', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      const ceres = new Ceres();
      game.colonies = [luna, ceres];

      // Draw a project card with known cost from the test deck
      const drawnCard = game.projectDeck.drawN(game, 1)[0];
      // Put it back so selectRandomColony can draw it
      game.projectDeck.drawPile.push(drawnCard);

      const colony = selectRandomColony(game, marsBot);
      expect(colony).to.not.be.undefined;
      // Index = (cost - 1) % 2
      const expectedIndex = (drawnCard.cost - 1) % 2;
      expect(colony!.name).to.eq([luna, ceres][expectedIndex].name);
    });

    it('discards the flipped card', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = [new Luna()];
      const discardBefore = game.projectDeck.discardPile.length;
      selectRandomColony(game, marsBot);
      expect(game.projectDeck.discardPile.length).to.eq(discardBefore + 1);
    });

    it('returns undefined if no eligible colonies', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = []; // No colonies in game
      const colony = selectRandomColony(game, marsBot);
      expect(colony).to.be.undefined;
    });

    it('handles 0-cost card without returning undefined (negative modulo fix)', () => {
      // JS: (0 - 1) % N = -1, so ((0-1) % N + N) % N = N-1 (last tile)
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      const ceres = new Ceres();
      game.colonies = [luna, ceres];
      // Inject a 0-cost card at the front of the draw pile
      game.projectDeck.drawPile.unshift({cost: 0} as any);
      // Should NOT return undefined — 0-cost maps to last tile (index N-1 = 1 = ceres)
      const selected = selectRandomColony(game, marsBot);
      expect(selected).to.not.be.undefined;
      expect(selected!.name).to.eq(ColonyName.CERES); // (0-1+2)%2 = 1 = ceres
    });
  });

  describe('placeColonyForMarsBot (C-19)', () => {
    it('adds MarsBot to colony.colonies array', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      placeColonyForMarsBot(luna, marsBot);
      expect(luna.colonies).to.include(marsBot.player.id);
    });

    it('adds 2 resources to shipping board instead of printed reward (C-19)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      placeColonyForMarsBot(luna, marsBot);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
    });

    it('updates trackPosition if colonies.length exceeds it', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 1;
      luna.colonies = ['phuman-id']; // 1 colony already
      game.colonies = [luna];
      placeColonyForMarsBot(luna, marsBot);
      expect(luna.trackPosition).to.be.at.least(luna.colonies.length);
    });
  });

  describe('Europa special case (C-24a)', () => {
    it('places ocean tile instead of 2 resources', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const europa = new Europa();
      game.colonies = [europa];
      const oceansBefore = game.board.getOceanSpaces().length;
      placeColonyForMarsBot(europa, marsBot);
      expect(game.board.getOceanSpaces().length).to.eq(oceansBefore + 1);
      expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0); // No storage
    });

    it('adds MarsBot to Europa colonies', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const europa = new Europa();
      game.colonies = [europa];
      placeColonyForMarsBot(europa, marsBot);
      expect(europa.colonies).to.include(marsBot.player.id);
    });

    it('failed action if ocean maxed', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const europa = new Europa();
      game.colonies = [europa];
      // Max all oceans
      while (game.canAddOcean()) {
        marsBot.turnResolver.placeOcean();
      }
      const mcBefore = marsBot.turnResolver.mcSupply;
      placeColonyForMarsBot(europa, marsBot);
      // Should be a failed action (gains MC)
      expect(marsBot.turnResolver.mcSupply).to.be.greaterThan(mcBefore);
      expect(europa.colonies).to.not.include(marsBot.player.id);
    });
  });

  describe('Titan special case (C-23)', () => {
    it('without Venus Next: adds 2 to Titan storage', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      game.colonies = [titan];
      placeColonyForMarsBot(titan, marsBot);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(2);
    });

    it('with Venus Next: adds 2 floaters to floaterCount', () => {
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
      placeColonyForMarsBot(titan, marsBot);
      expect(marsBot.floaterCount).to.eq(floatersBefore + 2);
    });

    it('Titan storage overflow does NOT advance any track (C-23)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      game.colonies = [titan, new Luna()];
      // Add enough Titan floaters to hit overflow threshold
      marsBot.shippingBoard.add(ColonyName.TITAN, 3, marsBot);
      const plantIdx = marsBot.board.getTrackIndexForTag(Tag.PLANT)!;
      const plantBefore = marsBot.board.tracks[plantIdx].position;
      placeColonyForMarsBot(titan, marsBot); // Adds 2 more = 5 total, but exempt from C-12
      expect(marsBot.board.tracks[plantIdx].position).to.eq(plantBefore); // No overflow
    });
  });
});
