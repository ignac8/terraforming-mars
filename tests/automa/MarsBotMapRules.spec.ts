import {expect} from 'chai';
import {getAutomaMaxGeneration} from '@/common/automa/AutomaTypes';
import {marsBotMapRules} from '@/common/automa/MarsBotMapRules';
import {BoardName} from '@/common/boards/BoardName';
import {getMcPerVP} from '@/server/automa/MarsBotScoring';
import {testGame} from '../TestGame';

describe('MarsBotMapRules', () => {
  it('gives only Amazonis Planitia extra rules', () => {
    expect(marsBotMapRules(BoardName.AMAZONIS_PLANITIA)).deep.eq({extraGenerations: 2, generationShift: 1, turmoilTRExtra: 1});
    for (const boardName of [
      BoardName.THARSIS,
      BoardName.HELLAS,
      BoardName.ELYSIUM,
      BoardName.UTOPIA_PLANITIA,
      BoardName.VASTITAS_BOREALIS_NOVA,
      BoardName.TERRA_CIMMERIA_NOVA,
    ]) {
      expect(marsBotMapRules(boardName), boardName).deep.eq({extraGenerations: 0, generationShift: 0, turmoilTRExtra: 0});
    }
  });

  describe('generation limit', () => {
    it('adds the extra generations on Amazonis Planitia', () => {
      expect(getAutomaMaxGeneration(false, BoardName.AMAZONIS_PLANITIA)).eq(22);
      expect(getAutomaMaxGeneration(true, BoardName.AMAZONIS_PLANITIA)).eq(20);
    });

    it('keeps 20 and 18 on the other maps', () => {
      expect(getAutomaMaxGeneration(false, BoardName.THARSIS)).eq(20);
      expect(getAutomaMaxGeneration(true, BoardName.HELLAS)).eq(18);
    });
  });

  describe('M€ per VP', () => {
    it('counts back from the longer limit on Amazonis Planitia', () => {
      expect(getMcPerVP(14, false, BoardName.AMAZONIS_PLANITIA)).eq(8);
      expect(getMcPerVP(15, false, BoardName.AMAZONIS_PLANITIA)).eq(7);
      expect(getMcPerVP(21, false, BoardName.AMAZONIS_PLANITIA)).eq(1);
      expect(getMcPerVP(22, false, BoardName.AMAZONIS_PLANITIA)).is.undefined;
    });

    it('counts back from the longer Prelude limit on Amazonis Planitia', () => {
      expect(getMcPerVP(12, true, BoardName.AMAZONIS_PLANITIA)).eq(8);
      expect(getMcPerVP(13, true, BoardName.AMAZONIS_PLANITIA)).eq(7);
      expect(getMcPerVP(19, true, BoardName.AMAZONIS_PLANITIA)).eq(1);
      expect(getMcPerVP(20, true, BoardName.AMAZONIS_PLANITIA)).is.undefined;
    });

    it('is unchanged on Tharsis', () => {
      expect(getMcPerVP(12, false, BoardName.THARSIS)).eq(8);
      expect(getMcPerVP(13, false, BoardName.THARSIS)).eq(7);
      expect(getMcPerVP(10, true, BoardName.THARSIS)).eq(8);
      expect(getMcPerVP(11, true, BoardName.THARSIS)).eq(7);
    });
  });

  describe('game', () => {
    function setup(boardName: BoardName, preludeExtension: boolean) {
      const [game] = testGame(1, {automa: true, boardName, preludeExtension});
      return {game, marsBot: game.automaHooks!.marsBot};
    }

    it('lets MarsBot win at generation 22 on Amazonis Planitia', () => {
      const {game, marsBot} = setup(BoardName.AMAZONIS_PLANITIA, false);
      expect(game.automaHooks!.lastSoloGeneration()).eq(22);

      game.generation = 21;
      expect(marsBot.isInstantWin()).is.false;
      expect(game.automaHooks!.isGameOver()).is.false;

      game.generation = 22;
      expect(marsBot.isInstantWin()).is.true;
      expect(game.automaHooks!.isGameOver()).is.true;
    });

    it('lets MarsBot win at generation 20 on Amazonis Planitia with Prelude', () => {
      const {game, marsBot} = setup(BoardName.AMAZONIS_PLANITIA, true);
      expect(game.automaHooks!.lastSoloGeneration()).eq(20);

      game.generation = 19;
      expect(marsBot.isInstantWin()).is.false;
      expect(game.automaHooks!.isGameOver()).is.false;

      game.generation = 20;
      expect(marsBot.isInstantWin()).is.true;
      expect(game.automaHooks!.isGameOver()).is.true;
    });

    it('still lets MarsBot win at generation 20 on Tharsis', () => {
      const {game, marsBot} = setup(BoardName.THARSIS, false);
      game.generation = 19;
      expect(marsBot.isInstantWin()).is.false;

      game.generation = 20;
      expect(marsBot.isInstantWin()).is.true;
    });

    it('converts M€ at 1 VP per 8 until generation 14 on Amazonis Planitia', () => {
      const {game, marsBot} = setup(BoardName.AMAZONIS_PLANITIA, false);
      marsBot.turnResolver.megacredits = 14;

      game.generation = 14;
      expect(marsBot.getVictoryPoints().mcToVP).eq(1);
      expect(marsBot.toModel().mcPerVP).eq(8);

      game.generation = 15;
      expect(marsBot.getVictoryPoints().mcToVP).eq(2);
      expect(marsBot.toModel().mcPerVP).eq(7);
    });

    it('converts M€ at 1 VP per 8 until generation 12 on Amazonis Planitia with Prelude', () => {
      const {game, marsBot} = setup(BoardName.AMAZONIS_PLANITIA, true);
      marsBot.turnResolver.megacredits = 14;

      game.generation = 12;
      expect(marsBot.getVictoryPoints().mcToVP).eq(1);
      expect(marsBot.toModel().mcPerVP).eq(8);

      game.generation = 13;
      expect(marsBot.getVictoryPoints().mcToVP).eq(2);
      expect(marsBot.toModel().mcPerVP).eq(7);
    });

    for (const run of [
      {preludeExtension: false, secondToLast: 20, last: 21},
      {preludeExtension: true, secondToLast: 18, last: 19},
    ]) {
      it('still converts M€ in the last two generations before the limit on Amazonis Planitia: ' + JSON.stringify(run), () => {
        const {game, marsBot} = setup(BoardName.AMAZONIS_PLANITIA, run.preludeExtension);
        marsBot.turnResolver.megacredits = 7;

        game.generation = run.secondToLast;
        expect(marsBot.getVictoryPoints().mcToVP).eq(3);

        game.generation = run.last;
        expect(marsBot.getVictoryPoints().mcToVP).eq(7);
      });
    }
  });
});
