import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {TileType} from '../../src/common/TileType';
import {calculateVictoryPoints} from '../../src/server/game/calculateVictoryPoints';
import {AwardScorer} from '../../src/server/awards/AwardScorer';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: 'normal', boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.marsBot!};
}

describe('MarsBot Award Crash Fix', () => {
  describe('calculateVictoryPoints does not crash with funded awards', () => {
    it('no crash when human funds an award', () => {
      const {game, human} = createAutomaGame();
      game.fundAward(human, game.awards[0]);

      // This was crashing: players[1] is undefined because game.players only has human
      expect(() => calculateVictoryPoints(human)).to.not.throw();
    });

    it('no crash when MarsBot funds an award', () => {
      const {game, human, marsBot} = createAutomaGame();
      game.fundAward(marsBot.player, game.awards[0]);

      expect(() => calculateVictoryPoints(human)).to.not.throw();
    });

    it('no crash with multiple funded awards', () => {
      const {game, human, marsBot} = createAutomaGame();
      game.fundAward(human, game.awards[0]);
      game.fundAward(marsBot.player, game.awards[1]);
      game.fundAward(human, game.awards[2]);

      expect(() => calculateVictoryPoints(human)).to.not.throw();
    });

    it('no crash when passing generations (updatePlayerVPForTheGeneration)', () => {
      const {game, human, marsBot} = createAutomaGame();
      game.fundAward(marsBot.player, game.awards[0]);

      // This triggers calculateVictoryPoints for all players
      expect(() => {
        human.victoryPointsByGeneration.push(human.getVictoryPoints().total);
      }).to.not.throw();
    });
  });

  describe('AwardScorer includes MarsBot scores', () => {
    it('AwardScorer has MarsBot score for Scientist (track 4)', () => {
      const {game, marsBot} = createAutomaGame();
      for (let i = 0; i < 6; i++) marsBot.board.getTrack(4).advance();

      const award = game.awards.find((a) => a.name === 'Scientist')!;
      const scorer = new AwardScorer(game, award);
      expect(scorer.get(marsBot.player)).to.eq(6);
    });

    it('AwardScorer has MarsBot score for Banker (track 1 + track 3)', () => {
      const {game, marsBot} = createAutomaGame();
      for (let i = 0; i < 3; i++) marsBot.board.getTrack(1).advance();
      for (let i = 0; i < 4; i++) marsBot.board.getTrack(3).advance();

      const award = game.awards.find((a) => a.name === 'Banker')!;
      const scorer = new AwardScorer(game, award);
      expect(scorer.get(marsBot.player)).to.eq(3 + 4);
    });

    it('AwardScorer has MarsBot score for Thermalist (track 5 + 5)', () => {
      const {game, marsBot} = createAutomaGame();
      for (let i = 0; i < 2; i++) marsBot.board.getTrack(5).advance();

      const award = game.awards.find((a) => a.name === 'Thermalist')!;
      const scorer = new AwardScorer(game, award);
      expect(scorer.get(marsBot.player)).to.eq(2 + 5);
    });

    it('AwardScorer has MarsBot score for Miner (track 2 + 5)', () => {
      const {game, marsBot} = createAutomaGame();
      for (let i = 0; i < 8; i++) marsBot.board.getTrack(2).advance();

      const award = game.awards.find((a) => a.name === 'Miner')!;
      const scorer = new AwardScorer(game, award);
      expect(scorer.get(marsBot.player)).to.eq(8 + 5);
    });

    it('AwardScorer has MarsBot score for Landlord (tiles owned)', () => {
      const {game, marsBot} = createAutomaGame();
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[5], {tileType: TileType.GREENERY});
      game.simpleAddTile(marsBot.player, spaces[10], {tileType: TileType.CITY});

      const award = game.awards.find((a) => a.name === 'Landlord')!;
      const scorer = new AwardScorer(game, award);
      expect(scorer.get(marsBot.player)).to.eq(2);
    });

    it('AwardScorer returns 0 for MarsBot when no automa hooks', () => {
      // Normal 2-player game — no automa
      const [game, p1, p2] = testGame(2);
      const award = game.awards[0];
      const scorer = new AwardScorer(game, award);
      // Should not crash, both players are in game.players
      expect(scorer.get(p1)).to.be.a('number');
      expect(scorer.get(p2)).to.be.a('number');
    });
  });

  describe('Award VP correctly assigned with MarsBot', () => {
    it('human gets 5 VP for winning a funded award over MarsBot', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Fund Landlord
      const landlord = game.awards.find((a) => a.name === 'Landlord')!;
      game.fundAward(human, landlord);

      // Human has 5 tiles, MarsBot has 1
      const spaces = game.board.getAvailableSpacesOnLand(human);
      for (let i = 0; i < 5; i++) {
        game.simpleAddTile(human, spaces[i], {tileType: TileType.GREENERY});
      }
      game.simpleAddTile(marsBot.player, spaces[10], {tileType: TileType.CITY});

      const vp = calculateVictoryPoints(human);
      expect(vp.awards).to.be.gte(5);
    });

    it('human gets 0 award VP for losing a funded award to MarsBot (no 2nd place in 2-player)', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Fund Scientist (track 4 based)
      const scientist = game.awards.find((a) => a.name === 'Scientist')!;
      game.fundAward(human, scientist);

      // MarsBot track 4 at 10, human has 0 science tags
      for (let i = 0; i < 10; i++) marsBot.board.getTrack(4).advance();

      const vp = calculateVictoryPoints(human);
      expect(vp.awards).to.eq(0);
    });

    it('human gets 0 award VP with no funded awards', () => {
      const {game, human} = createAutomaGame();
      const vp = calculateVictoryPoints(human);
      expect(vp.awards).to.eq(0);
    });
  });
});
