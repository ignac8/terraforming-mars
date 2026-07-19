import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {Luna} from '../../../src/server/colonies/Luna';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Europa} from '../../../src/server/colonies/Europa';
import {Titan} from '../../../src/server/colonies/Titan';
import {BoardName} from '../../../src/common/boards/BoardName';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('PlayerTradeHook (C-21, C-24c)', () => {
  describe('handleColonyBonus', () => {
    it('returns false for non-MarsBot player IDs', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const luna = new Luna();
      game.colonies = [luna];
      const result = game.automaHooks!.handleColonyBonus(luna, 'psome-other-player');
      expect(result).to.be.false;
    });

    it('C-21: adds 1 resource to shipping board when player trades with a colony MarsBot owns', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.colonies = [marsBot.player.id];
      game.colonies = [luna];
      const storeBefore = marsBot.shippingBoard.get(ColonyName.LUNA);
      const result = game.automaHooks!.handleColonyBonus(luna, marsBot.player.id);
      expect(result).to.be.true;
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storeBefore + 1);
    });

    it('C-21: adds 1 resource to Ceres storage', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const ceres = new Ceres();
      ceres.colonies = [marsBot.player.id];
      game.colonies = [ceres];
      const storeBefore = marsBot.shippingBoard.get(ColonyName.CERES);
      game.automaHooks!.handleColonyBonus(ceres, marsBot.player.id);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(storeBefore + 1);
    });

    it('C-21/C-23: Titan colony bonus with Venus Next gives 1 floater, not Titan storage', () => {
      const [game] = testGame(1, {
        automaOption: true,
        coloniesExtension: true,
        venusNextExtension: true,
        boardName: BoardName.THARSIS,
      });
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      titan.colonies = [marsBot.player.id];
      game.colonies = [titan];
      const floatersBefore = marsBot.floaterCount;
      const titanStoreBefore = marsBot.shippingBoard.get(ColonyName.TITAN);
      const result = game.automaHooks!.handleColonyBonus(titan, marsBot.player.id);
      expect(result).to.be.true;
      expect(marsBot.floaterCount).to.eq(floatersBefore + 1);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(titanStoreBefore); // Titan storage unchanged
    });

    it('C-24c: Europa colony bonus gives 1 MC to mcSupply, not shipping board', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const europa = new Europa();
      europa.colonies = [marsBot.player.id];
      game.colonies = [europa];
      const mcBefore = marsBot.turnResolver.mcSupply;
      const result = game.automaHooks!.handleColonyBonus(europa, marsBot.player.id);
      expect(result).to.be.true;
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 1);
      // No storage change for Europa
      expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0);
    });
  });

  describe('integration: player trading triggers C-21', () => {
    it('MarsBot gets 1 resource when player trades with a colony MarsBot owns', () => {
      const [game, player] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.colonies = [marsBot.player.id]; // MarsBot has colony on Luna
      game.colonies = [luna];

      const storeBefore = marsBot.shippingBoard.get(ColonyName.LUNA);

      // Player trades with Luna — GiveColonyBonus should give MarsBot 1 resource via C-21
      luna.trade(player, {usesTradeFleet: false, decreaseTrackAfterTrade: false, giveColonyBonuses: true});

      // Process deferred actions
      game.deferredActions.runAll(() => {});

      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storeBefore + 1);
    });
  });
});
