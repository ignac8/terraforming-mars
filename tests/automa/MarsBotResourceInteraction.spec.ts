import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {Resource} from '../../src/common/Resource';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: 'normal', boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.marsBot!};
}

describe('MarsBot Resource Interaction (rules page 4-5)', () => {
  describe('Human is in MarsBot opponents list', () => {
    it('MarsBot player is in human opponents', () => {
      const {human, marsBot} = createAutomaGame();
      expect(human.opponents).to.include(marsBot.player);
    });

    it('human can see MarsBot as steal/remove target', () => {
      const {human, marsBot} = createAutomaGame();
      const targets = human.opponents.filter((p) => p.name === 'MarsBot');
      expect(targets.length).to.eq(1);
    });
  });

  describe('Remove resources from MarsBot → deduct from MC supply', () => {
    it('removing plants from MarsBot deducts from mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      // Simulate removing 3 plants (via stock.add with negative amount)
      marsBot.player.stock.add(Resource.PLANTS, -3, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.mcSupply).to.eq(7);
    });

    it('removing steel from MarsBot deducts from mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      marsBot.player.stock.add(Resource.STEEL, -2, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.mcSupply).to.eq(8);
    });

    it('removing more than mcSupply clamps to 0', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 3;

      marsBot.player.stock.add(Resource.PLANTS, -10, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.mcSupply).to.eq(0);
    });

    it('removing heat from MarsBot deducts from mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 15;

      marsBot.player.stock.add(Resource.HEAT, -5, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.mcSupply).to.eq(10);
    });
  });

  describe('Steal resources from MarsBot → deduct from MC supply', () => {
    it('stealing resources deducts from MarsBot mcSupply', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      // Use stock.steal which calls deduct internally
      marsBot.player.stock.steal(Resource.PLANTS, 3, human);

      // MarsBot should have lost MC
      expect(marsBot.turnResolver.mcSupply).to.eq(7);
    });
  });

  describe('Decrease production → regress track', () => {
    it('decreasing steel production regresses Track 1', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.getTrack(1).advance();
      marsBot.board.getTrack(1).advance();
      expect(marsBot.board.getTrack(1).position).to.eq(2);

      // Decrease steel production via production.add with negative
      marsBot.player.production.add(Resource.STEEL, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.getTrack(1).position).to.eq(1);
    });

    it('decreasing titanium production regresses Track 2', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.getTrack(2).advance();
      marsBot.board.getTrack(2).advance();
      marsBot.board.getTrack(2).advance();

      marsBot.player.production.add(Resource.TITANIUM, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.getTrack(2).position).to.eq(2);
    });

    it('decreasing MC production regresses Track 3', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.getTrack(3).advance();

      marsBot.player.production.add(Resource.MEGACREDITS, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.getTrack(3).position).to.eq(0);
    });

    it('decreasing energy production regresses Track 5', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.getTrack(5).advance();
      marsBot.board.getTrack(5).advance();

      marsBot.player.production.add(Resource.ENERGY, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.getTrack(5).position).to.eq(1);
    });

    it('decreasing heat production regresses Track 6', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.getTrack(6).advance();

      marsBot.player.production.add(Resource.HEAT, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.getTrack(6).position).to.eq(0);
    });

    it('decreasing plant production regresses Track 7', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.getTrack(7).advance();
      marsBot.board.getTrack(7).advance();

      marsBot.player.production.add(Resource.PLANTS, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.getTrack(7).position).to.eq(1);
    });

    it('decreasing production by 2 regresses track twice', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 5; i++) marsBot.board.getTrack(1).advance();

      marsBot.player.production.add(Resource.STEEL, -2, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.getTrack(1).position).to.eq(3);
    });

    it('production increase is ignored', () => {
      const {marsBot} = createAutomaGame();
      const posBefore = marsBot.board.getTrack(1).position;

      marsBot.player.production.add(Resource.STEEL, 3, {log: true});
      // No change — MarsBot ignores production increases
      expect(marsBot.board.getTrack(1).position).to.eq(posBefore);
    });
  });

  describe('Resource additions to MarsBot are ignored', () => {
    it('adding plants to MarsBot does not affect mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      marsBot.player.stock.add(Resource.PLANTS, 5);
      expect(marsBot.turnResolver.mcSupply).to.eq(10); // Unchanged
    });

    it('adding MC to MarsBot does not affect mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      marsBot.player.stock.add(Resource.MEGACREDITS, 5);
      expect(marsBot.turnResolver.mcSupply).to.eq(10); // Unchanged
    });
  });
});
