import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BoardName} from '../../src/common/boards/BoardName';
import {ApiCreateGame} from '../../src/server/routes/ApiCreateGame';
import {ColonyName} from '../../src/common/colonies/ColonyName';

describe('MarsBotGameCreation', () => {
  describe('Server-side expansion gating', () => {
    it('automa game forces Venus off', () => {
      const [game] = testGame(1, {
        automaOption: true,
        venusNextExtension: true,
        boardName: BoardName.THARSIS,
      });
      // Venus is now supported for automa
      expect(game.gameOptions.venusNextExtension).to.be.true;
    });

    it('automa game supports Colonies (C-1)', () => {
      const [game] = testGame(1, {
        automaOption: true,
        coloniesExtension: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.coloniesExtension).to.be.true;
      // C-1: 2-player setup = 5 colonies active
      expect(game.colonies.length).to.eq(5);
    });

    it('starts Titan, Enceladus and Miranda active on their second step (C-1)', () => {
      const customColoniesList = [ColonyName.TITAN, ColonyName.ENCELADUS, ColonyName.MIRANDA, ColonyName.LUNA, ColonyName.CERES];
      const [game] = testGame(1, {
        automaOption: true,
        coloniesExtension: true,
        customColoniesList,
        boardName: BoardName.THARSIS,
      });

      for (const colony of game.colonies) {
        expect(colony.isActive, colony.name).to.be.true;
        expect(colony.trackPosition, colony.name).to.eq(1);
      }
    });

    it('leaves Titan, Enceladus and Miranda inactive outside automa games', () => {
      const customColoniesList = [ColonyName.TITAN, ColonyName.ENCELADUS, ColonyName.MIRANDA, ColonyName.LUNA, ColonyName.CERES];
      const [game] = testGame(2, {coloniesExtension: true, customColoniesList});

      const inactive = game.colonies.filter((c) => !c.isActive).map((c) => c.name);
      expect(inactive).to.have.members([ColonyName.TITAN, ColonyName.ENCELADUS, ColonyName.MIRANDA]);
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
