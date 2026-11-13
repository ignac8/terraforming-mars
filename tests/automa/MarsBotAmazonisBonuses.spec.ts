import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {Luna} from '@/server/colonies/Luna';
import {BuildColony} from '@/server/deferredActions/BuildColony';
import {testGame} from '../TestGame';
import {maxOutOceans, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../TestingUtils';

function amazonisGame(options: {colonies: boolean}) {
  const [game, human] = testGame(1, {
    automa: true,
    venusNextExtension: true,
    coloniesExtension: options.colonies,
    boardName: BoardName.AMAZONIS_PLANITIA,
  });
  const marsBot = game.automaHooks!.marsBot;
  const luna = new Luna();
  game.colonies = [luna];
  return {game, human, marsBot, luna};
}

describe('MarsBotAmazonisBonuses', () => {
  describe('plant production at -12 C', () => {
    it('pays MarsBot 2 M€ and no plant production', () => {
      const {game, marsBot} = amazonisGame({colonies: false});
      setTemperature(game, -14);
      const mc = marsBot.turnResolver.megacredits;

      marsBot.turnResolver.raiseTemperature(1);

      expect(game.getTemperature()).eq(-12);
      expect(marsBot.turnResolver.megacredits).eq(mc + 2);
      expect(marsBot.player.production.plants).eq(0);
    });

    it('still gives a human the plant production', () => {
      const {game, human} = amazonisGame({colonies: false});
      setTemperature(game, -14);

      game.increaseTemperature(human, 1);

      expect(human.production.plants).eq(1);
    });

    it('pays MarsBot 2 M€ when Lobbyists raises two steps across it', () => {
      const {game, marsBot} = amazonisGame({colonies: false});
      setTemperature(game, -14);
      const mc = marsBot.turnResolver.megacredits;

      marsBot.resolveBonusCard(BonusCardId.B06_LOBBYISTS);

      expect(game.getTemperature()).eq(-10);
      expect(marsBot.turnResolver.megacredits).eq(mc + 2);
    });

    it('pays MarsBot no M€ when Government Intervention raises across it', () => {
      const {game, marsBot} = amazonisGame({colonies: false});
      game.generation = 4;
      setTemperature(game, -14);
      setOxygenLevel(game, 14);
      maxOutOceans(game.players[0], 9);
      setVenusScaleLevel(game, 30);
      const mc = marsBot.turnResolver.megacredits;

      marsBot.resolveBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION);

      expect(game.getTemperature()).eq(-12);
      expect(marsBot.turnResolver.megacredits).eq(mc);
    });
  });

  describe('colony at 16% Venus', () => {
    it('builds a colony for MarsBot and defers nothing', () => {
      const {game, marsBot, luna} = amazonisGame({colonies: true});
      setVenusScaleLevel(game, 14);

      game.increaseVenusScaleLevel(marsBot.player, 1);

      expect(game.getVenusScaleLevel()).eq(16);
      expect(luna.colonies).deep.eq([marsBot.player.id]);
      expect(game.deferredActions.length).eq(0);
    });

    it('builds a colony for MarsBot when Lobbyists raises two steps across it', () => {
      const {game, marsBot, luna} = amazonisGame({colonies: true});
      setTemperature(game, 14);
      setOxygenLevel(game, 18);
      setVenusScaleLevel(game, 14);

      marsBot.resolveBonusCard(BonusCardId.B15_LOBBYISTS_VENUS);

      expect(game.getVenusScaleLevel()).eq(18);
      expect(luna.colonies).deep.eq([marsBot.player.id]);
      expect(game.deferredActions.length).eq(0);
    });

    it('does nothing without Colonies, and defers nothing', () => {
      const {game, marsBot} = amazonisGame({colonies: false});
      setVenusScaleLevel(game, 14);
      const mc = marsBot.turnResolver.megacredits;

      game.increaseVenusScaleLevel(marsBot.player, 1);

      expect(game.getVenusScaleLevel()).eq(16);
      expect(marsBot.turnResolver.megacredits).eq(mc);
      expect(game.deferredActions.length).eq(0);
    });

    it('still asks a human where to build the colony', () => {
      const {game, human} = amazonisGame({colonies: true});
      setVenusScaleLevel(game, 14);

      game.increaseVenusScaleLevel(human, 1);

      const action = game.deferredActions.peek();
      expect(action).instanceOf(BuildColony);
      expect(action!.player).eq(human);
    });
  });
});
