import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BoardName} from '../../src/common/boards/BoardName';
import {GameOptions, DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {ApiCreateGame} from '../../src/server/routes/ApiCreateGame';

describe('MarsBotGameCreation', () => {
  describe('Server-side expansion gating', () => {
    function createAutomaOptions(overrides: Partial<GameOptions> = {}): GameOptions {
      return {
        ...DEFAULT_GAME_OPTIONS,
        automaOption: true,
        automaDifficulty: 'normal',
        ...overrides,
      };
    }

    it('automa game forces Venus off', () => {
      const [game] = testGame(1, {
        automaOption: true,
        venusNextExtension: true,
        boardName: BoardName.THARSIS,
      });
      // Venus is now supported for automa
      expect(game.gameOptions.venusNextExtension).to.be.true;
    });

    it('automa game forces Colonies off', () => {
      const [game] = testGame(1, {
        automaOption: true,
        coloniesExtension: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.coloniesExtension).to.be.false;
    });

    it('automa game supports Turmoil', () => {
      const [game] = testGame(1, {
        automaOption: true,
        turmoilExtension: true,
        boardName: BoardName.THARSIS,
      });
      // Turmoil is now supported for automa games
      expect(game.gameOptions.turmoilExtension).to.be.true;
    });

    it('automa game forces Ares off', () => {
      const [game] = testGame(1, {
        automaOption: true,
        aresExtension: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.aresExtension).to.be.false;
    });

    it('automa game forces Moon off', () => {
      const [game] = testGame(1, {
        automaOption: true,
        moonExpansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.moonExpansion).to.be.false;
    });

    it('automa game forces Pathfinders off', () => {
      const [game] = testGame(1, {
        automaOption: true,
        pathfindersExpansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.pathfindersExpansion).to.be.false;
    });

    it('automa game forces CEOs off', () => {
      const [game] = testGame(1, {
        automaOption: true,
        ceoExtension: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.ceoExtension).to.be.false;
    });

    it('automa game forces Star Wars off', () => {
      const [game] = testGame(1, {
        automaOption: true,
        starWarsExpansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.starWarsExpansion).to.be.false;
    });

    it('automa game forces Underworld off', () => {
      const [game] = testGame(1, {
        automaOption: true,
        underworldExpansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.underworldExpansion).to.be.false;
    });

    it('automa game allows Prelude', () => {
      const [game] = testGame(1, {
        automaOption: true,
        preludeExtension: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.preludeExtension).to.be.true;
    });

    it('automa game allows Prelude 2', () => {
      const [game] = testGame(1, {
        automaOption: true,
        preludeExtension: true,
        prelude2Expansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.prelude2Expansion).to.be.true;
    });

    it('automa game allows Promo cards', () => {
      const [game] = testGame(1, {
        automaOption: true,
        promoCardsOption: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.promoCardsOption).to.be.true;
    });

    it('automa game forces Tharsis board', () => {
      const [game] = testGame(1, {
        automaOption: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.boardName).to.eq(BoardName.THARSIS);
    });
  });

  describe('Board options', () => {
    it('ApiCreateGame.boardOptions returns correct boards', () => {
      expect(ApiCreateGame.boardOptions(BoardName.THARSIS)).to.deep.eq([BoardName.THARSIS]);
      expect(ApiCreateGame.boardOptions(BoardName.HELLAS)).to.deep.eq([BoardName.HELLAS]);
    });
  });
});
