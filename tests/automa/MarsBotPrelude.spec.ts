import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {CardName} from '../../src/common/cards/CardName';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {MARSBOT_MAX_GENERATION, MARSBOT_MAX_GENERATION_PRELUDE} from '../../src/common/automa/AutomaTypes';

function createAutomaGame(opts: {prelude?: boolean, prelude2?: boolean, difficulty?: 'easy' | 'normal' | 'hard' | 'brutal'} = {}): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: opts.difficulty ?? 'normal',
    boardName: BoardName.THARSIS,
    preludeExtension: opts.prelude ?? false,
    prelude2Expansion: opts.prelude2 ?? false,
  });
  expect(game.automaHooks?.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

describe('MarsBot Prelude Support', () => {
  describe('Setup', () => {
    it('MarsBot does NOT receive Prelude cards', () => {
      const {marsBot} = createAutomaGame({prelude: true});
      expect(marsBot.player.dealtPreludeCards).to.have.length(0);
    });

    it('MarsBot receives 3 extra project cards with Prelude (7 total in initial action deck)', () => {
      const {marsBot} = createAutomaGame({prelude: true});
      // Normal: 3 project + 1 bonus = 4. With Prelude: 6 project + 1 bonus = 7
      expect(marsBot.actionDeck.length).to.eq(7);
    });

    it('MarsBot has normal 4-card action deck without Prelude', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.actionDeck.length).to.eq(4);
    });

    it('MarsBot receives 3 extra project cards with Prelude 2 only', () => {
      const {marsBot} = createAutomaGame({prelude: true, prelude2: true});
      expect(marsBot.actionDeck.length).to.eq(7);
    });
  });

  describe('Recession removal', () => {
    it('Recession is removed from Prelude deck when automa + Prelude 2', () => {
      const {game} = createAutomaGame({prelude: true, prelude2: true});
      // Check that Recession is not in any deck
      const allPreludeCards = [
        ...game.preludeDeck.drawPile,
        ...game.preludeDeck.discardPile,
      ];
      const recession = allPreludeCards.find((c) => c.name === CardName.RECESSION);
      expect(recession).to.be.undefined;
    });

    it('Recession is NOT removed in non-automa games with Prelude 2', () => {
      const [game] = testGame(2, {
        preludeExtension: true,
        prelude2Expansion: true,
      });
      const allPreludeCards = [
        ...game.preludeDeck.drawPile,
        ...game.preludeDeck.discardPile,
      ];
      const recession = allPreludeCards.find((c) => c.name === CardName.RECESSION);
      expect(recession).to.not.be.undefined;
    });
  });

  describe('Wild tag handling', () => {
    it('Wild tag advances least-advanced track', () => {
      const board = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
      // Advance track 0 to position 3, leave others at 0
      board.tracks[0].position = 3;
      board.tracks[1].position = 2;
      board.tracks[2].position = 1;
      // Tracks 3-6 are all at 0, so least-advanced is track 3 (first at 0, topmost)
      const leastIndex = board.getLeastAdvancedTrackIndex();
      expect(leastIndex).to.eq(3);
    });

    it('Wild tag with tie: topmost track (lowest index) wins', () => {
      const board = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
      // All tracks at 0 — least advanced is track 0 (topmost)
      const leastIndex = board.getLeastAdvancedTrackIndex();
      expect(leastIndex).to.eq(0);
    });

    it('Wild tag with tie: picks lowest index among tied tracks', () => {
      const board = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
      // Set all tracks to 5, except tracks 2 and 4 at 3
      for (let i = 0; i < 7; i++) {
        board.tracks[i].position = 5;
      }
      board.tracks[2].position = 3;
      board.tracks[4].position = 3;
      const leastIndex = board.getLeastAdvancedTrackIndex();
      expect(leastIndex).to.eq(2); // Track 2 is topmost of the tied ones
    });
  });

  describe('Generation limits', () => {
    it('lastSoloGeneration returns 18 with Prelude', () => {
      const {game} = createAutomaGame({prelude: true});
      expect(game.automaHooks!.lastSoloGeneration()).to.eq(18);
    });

    it('lastSoloGeneration returns 20 without Prelude', () => {
      const {game} = createAutomaGame();
      expect(game.automaHooks!.lastSoloGeneration()).to.eq(20);
    });

    it('getMaxGeneration returns 18 with Prelude', () => {
      const {game} = createAutomaGame({prelude: true});
      expect(game.automaHooks!.getMaxGeneration()).to.eq(MARSBOT_MAX_GENERATION_PRELUDE);
    });

    it('getMaxGeneration returns 20 without Prelude', () => {
      const {game} = createAutomaGame();
      expect(game.automaHooks!.getMaxGeneration()).to.eq(MARSBOT_MAX_GENERATION);
    });

    it('isGameOver returns true at generation 18 with Prelude', () => {
      const {game} = createAutomaGame({prelude: true});
      (game as any).generation = 18;
      expect(game.automaHooks!.isGameOver()).to.be.true;
    });

    it('isGameOver returns false at generation 17 with Prelude', () => {
      const {game} = createAutomaGame({prelude: true});
      (game as any).generation = 17;
      expect(game.automaHooks!.isGameOver()).to.be.false;
    });

    it('isGameOver returns false at generation 18 without Prelude', () => {
      const {game} = createAutomaGame();
      (game as any).generation = 18;
      expect(game.automaHooks!.isGameOver()).to.be.false;
    });

    it('isGameOver returns true at generation 20 without Prelude', () => {
      const {game} = createAutomaGame();
      (game as any).generation = 20;
      expect(game.automaHooks!.isGameOver()).to.be.true;
    });
  });

  describe('MC to VP with Prelude', () => {
    it('MC to VP at gen 15 with Prelude: 1 VP per 3 MC', () => {
      const {game, marsBot} = createAutomaGame({prelude: true});
      (game as any).generation = 15;
      marsBot.turnResolver.mcSupply = 9;
      const scoring = marsBot.getVictoryPoints();
      expect(scoring.mcToVP).to.eq(3); // 9 / 3 = 3
    });

    it('MC to VP at gen 17 with Prelude: 1 VP per 1 MC', () => {
      const {game, marsBot} = createAutomaGame({prelude: true});
      (game as any).generation = 17;
      marsBot.turnResolver.mcSupply = 12;
      const scoring = marsBot.getVictoryPoints();
      expect(scoring.mcToVP).to.eq(12); // 12 / 1 = 12
    });

    it('instant win at gen 18 with Prelude: mcToVP is 0', () => {
      const {game, marsBot} = createAutomaGame({prelude: true});
      (game as any).generation = 18;
      marsBot.turnResolver.mcSupply = 100;
      const scoring = marsBot.getVictoryPoints();
      expect(scoring.mcToVP).to.eq(0); // Instant win, no VP calculation
    });

    it('gen 18 is NOT instant win without Prelude', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 18;
      marsBot.turnResolver.mcSupply = 8;
      const scoring = marsBot.getVictoryPoints();
      expect(scoring.mcToVP).to.eq(4); // 8 / 2 = 4 (gen 18 = 1 VP per 2 MC)
    });
  });
});
