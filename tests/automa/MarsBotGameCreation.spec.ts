import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BoardName} from '../../src/common/boards/BoardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardName} from '../../src/common/cards/CardName';
import {IGame} from '../../src/server/IGame';
import {MARSBOT_BOARD_NAMES} from '../../src/common/automa/MarsBotBoards';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {Tag} from '../../src/common/cards/Tag';

describe('MarsBotGameCreation', () => {
  describe('Server-side expansion gating', () => {
    it('automa game forces Venus off', () => {
      const [game] = testGame(1, {
        automa: true,
        venusNextExtension: true,
        boardName: BoardName.THARSIS,
      });
      // Venus is now supported for automa
      expect(game.gameOptions.venusNextExtension).to.be.true;
    });

    it('automa game supports Colonies (C-1)', () => {
      const [game] = testGame(1, {
        automa: true,
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
        automa: true,
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
        automa: true,
        turmoilExtension: true,
        boardName: BoardName.THARSIS,
      });
      // Turmoil is now supported for automa games
      expect(game.gameOptions.turmoilExtension).to.be.true;
    });

    it('automa game forces Ares off', () => {
      const [game] = testGame(1, {
        automa: true,
        aresExtension: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.aresExtension).to.be.false;
    });

    // Rulebook A, p.11: "You may not use this corporation against MarsBot."
    it('automa game leaves Mons Insurance out of the corporation deck', () => {
      const corporations = (game: IGame) => [
        ...game.corporationDeck.drawPile,
        ...game.corporationDeck.discardPile,
        ...game.players.flatMap((player) => player.dealtCorporationCards),
      ].map((card) => card.name);
      const [automaGame] = testGame(1, {
        automa: true,
        promoCardsOption: true,
        boardName: BoardName.THARSIS,
        skipInitialCardSelection: false,
      });
      const [game] = testGame(2, {promoCardsOption: true, skipInitialCardSelection: false});

      expect(corporations(automaGame)).to.not.include(CardName.MONS_INSURANCE);
      expect(corporations(game)).to.include(CardName.MONS_INSURANCE);
    });

    // Both would ask MarsBot to choose, and nobody answers for it.
    it('automa game forces the alternate Venus board off', () => {
      const [game] = testGame(1, {
        automa: true,
        venusNextExtension: true,
        altVenusBoard: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.altVenusBoard).to.be.false;
    });

    it('automa game uses the standard political agendas', () => {
      const [game] = testGame(1, {
        automa: true,
        turmoilExtension: true,
        politicalAgendasExtension: 'Chairman',
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.politicalAgendasExtension).to.eq('Standard');
    });

    it('automa game forces Moon off', () => {
      const [game] = testGame(1, {
        automa: true,
        moonExpansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.moonExpansion).to.be.false;
    });

    it('automa game forces Pathfinders off', () => {
      const [game] = testGame(1, {
        automa: true,
        pathfindersExpansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.pathfindersExpansion).to.be.false;
    });

    it('automa game forces CEOs off', () => {
      const [game] = testGame(1, {
        automa: true,
        ceoExtension: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.ceoExtension).to.be.false;
    });

    it('automa game forces Star Wars off', () => {
      const [game] = testGame(1, {
        automa: true,
        starWarsExpansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.starWarsExpansion).to.be.false;
    });

    it('automa game forces Underworld off', () => {
      const [game] = testGame(1, {
        automa: true,
        underworldExpansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.underworldExpansion).to.be.false;
    });

    it('automa game allows Prelude', () => {
      const [game] = testGame(1, {
        automa: true,
        preludeExtension: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.preludeExtension).to.be.true;
    });

    it('automa game allows Prelude 2', () => {
      const [game] = testGame(1, {
        automa: true,
        preludeExtension: true,
        prelude2Expansion: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.prelude2Expansion).to.be.true;
    });

    it('automa game allows Promo cards', () => {
      const [game] = testGame(1, {
        automa: true,
        promoCardsOption: true,
        boardName: BoardName.THARSIS,
      });
      expect(game.gameOptions.promoCardsOption).to.be.true;
    });

    for (const boardName of MARSBOT_BOARD_NAMES) {
      it('automa game keeps every map that has a MarsBot board: ' + boardName, () => {
        const [game] = testGame(1, {automa: true, boardName});
        expect(game.gameOptions.boardName).to.eq(boardName);
      });
    }

    it('automa game falls back to Tharsis on a map without a MarsBot board', () => {
      const [game] = testGame(1, {
        automa: true,
        boardName: BoardName.ARABIA_TERRA,
      });
      expect(game.gameOptions.boardName).to.eq(BoardName.THARSIS);
    });

    it('ignores a leftover modularMA when random milestones and awards are off', () => {
      const [game] = testGame(1, {
        automa: true,
        boardName: BoardName.HELLAS,
        modularMA: true,
        randomMA: RandomMAOptionType.NONE,
      });

      const board = game.automaHooks!.marsBot.marsBotBoard;
      expect(game.gameOptions.modularMA).to.be.false;
      expect(board.tracks[board.tagToTrack[Tag.SCIENCE]!].definition.tags).to.include(Tag.JOVIAN);
    });

    for (const randomMA of [RandomMAOptionType.LIMITED, RandomMAOptionType.UNLIMITED]) {
      it('falls back to Tharsis from Amazonis Planitia with the Milestones & Awards expansion: ' + randomMA, () => {
        const [game] = testGame(1, {
          automa: true,
          boardName: BoardName.AMAZONIS_PLANITIA,
          modularMA: true,
          randomMA,
        });

        expect(game.gameOptions.boardName).to.eq(BoardName.THARSIS);
      });
    }

    it('stays on Amazonis Planitia when a leftover modularMA meets random milestones and awards off', () => {
      const [game] = testGame(1, {
        automa: true,
        boardName: BoardName.AMAZONIS_PLANITIA,
        modularMA: true,
        randomMA: RandomMAOptionType.NONE,
      });

      expect(game.gameOptions.boardName).to.eq(BoardName.AMAZONIS_PLANITIA);
    });

    for (const boardName of MARSBOT_BOARD_NAMES.filter((name) => name !== BoardName.AMAZONIS_PLANITIA)) {
      it('keeps ' + boardName + ' with the Milestones & Awards expansion', () => {
        const [game] = testGame(1, {
          automa: true,
          boardName,
          modularMA: true,
          randomMA: RandomMAOptionType.LIMITED,
        });

        expect(game.gameOptions.boardName).to.eq(boardName);
      });
    }

    it('keeps modularMA when random milestones and awards are on', () => {
      const [game] = testGame(1, {
        automa: true,
        boardName: BoardName.HELLAS,
        modularMA: true,
        randomMA: RandomMAOptionType.LIMITED,
      });

      const board = game.automaHooks!.marsBot.marsBotBoard;
      expect(game.gameOptions.modularMA).to.be.true;
      expect(board.tracks[board.tagToTrack[Tag.SCIENCE]!].definition.tags).to.not.include(Tag.JOVIAN);
    });
  });
});
