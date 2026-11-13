import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {testGame} from '../TestGame';
import {maxOutOceans, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../TestingUtils';
import {resetCorpRegistry} from './corps/CorpGame';

function amazonisGame(venus: boolean = false) {
  const [game] = testGame(1, {automa: true, venusNextExtension: venus, boardName: BoardName.AMAZONIS_PLANITIA});
  const marsBot = game.automaHooks!.marsBot;
  return {game, marsBot, resolver: marsBot.turnResolver};
}

function pristarAmazonisGame() {
  const result = amazonisGame();
  result.marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
  result.marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
  return result;
}

describe('MarsBotAmazonisMaxima', () => {
  beforeEach(resetCorpRegistry);

  describe('temperature', () => {
    it('raises the temperature past 8 without a Failed Action', () => {
      const {game, resolver} = amazonisGame();
      setTemperature(game, 8);
      const mc = resolver.megacredits;

      resolver.raiseTemperature(1);

      expect(game.getTemperature()).eq(10);
      expect(resolver.megacredits).eq(mc);
    });

    it('takes a Failed Action at 14', () => {
      const {game, resolver} = amazonisGame();
      setTemperature(game, 14);
      const mc = resolver.megacredits;

      resolver.raiseTemperature(1);

      expect(game.getTemperature()).eq(14);
      expect(resolver.megacredits).eq(mc + resolver.failedActionMc);
    });

    it('lets a corp effect raise the temperature past 8', () => {
      const {game, marsBot} = amazonisGame();
      setTemperature(game, 8);

      marsBot.raiseTemperature(1);

      expect(game.getTemperature()).eq(10);
    });
  });

  describe('oxygen', () => {
    it('still raises oxygen with a greenery at 14', () => {
      const {game, resolver} = amazonisGame();
      setOxygenLevel(game, 14);

      resolver.placeGreenery();

      expect(game.getOxygenLevel()).eq(15);
    });

    it('lets Pristar cancel the oxygen raise of a greenery at 14', () => {
      const {game, marsBot, resolver} = pristarAmazonisGame();
      setOxygenLevel(game, 14);

      resolver.placeGreenery();

      expect(game.getOxygenLevel()).eq(14);
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).eq(0);
    });

    it('lets Pristar cancel the oxygen raise of a bonus card greenery at 14', () => {
      const {game, marsBot} = pristarAmazonisGame();
      setOxygenLevel(game, 14);

      marsBot['bonusResolver'].maybePlaceGreenery();

      expect(game.getOxygenLevel()).eq(14);
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).eq(0);
    });
  });

  describe('Venus', () => {
    it('raises Venus past 30 one step at a time', () => {
      const {game, resolver} = amazonisGame(true);
      setVenusScaleLevel(game, 30);
      const mc = resolver.megacredits;

      (resolver as any).raiseVenus(1);

      expect(game.getVenusScaleLevel()).eq(31);
      expect(resolver.megacredits).eq(mc);
    });

    it('takes a Failed Action at 33', () => {
      const {game, resolver} = amazonisGame(true);
      setVenusScaleLevel(game, 33);
      const mc = resolver.megacredits;

      (resolver as any).raiseVenus(1);

      expect(game.getVenusScaleLevel()).eq(33);
      expect(resolver.megacredits).eq(mc + resolver.failedActionMc);
    });

    it('raises Venus with Venusian Lobby past 30', () => {
      const {game, marsBot} = amazonisGame(true);
      setVenusScaleLevel(game, 30);

      marsBot.resolveBonusCard(BonusCardId.B26_VENUSIAN_LOBBY);

      expect(game.getVenusScaleLevel()).eq(31);
    });
  });

  describe('oceans', () => {
    it('places a 10th ocean', () => {
      const {game, resolver} = amazonisGame();
      maxOutOceans(game.players[0], 9);

      resolver.placeOcean();

      expect(game.board.getOceanSpaces()).has.length(10);
    });

    it('places an 11th ocean', () => {
      const {game, resolver} = amazonisGame();
      maxOutOceans(game.players[0], 10);

      resolver.placeOcean();

      expect(game.board.getOceanSpaces()).has.length(11);
    });

    it('takes a Failed Action at 11 oceans', () => {
      const {game, resolver} = amazonisGame();
      maxOutOceans(game.players[0], 11);
      const mc = resolver.megacredits;

      resolver.placeOcean();

      expect(game.board.getOceanSpaces()).has.length(11);
      expect(resolver.megacredits).eq(mc + resolver.failedActionMc);
    });
  });

  describe('furthest parameter', () => {
    it('advances oxygen when it has the most steps left', () => {
      const {game, marsBot} = amazonisGame();
      setOxygenLevel(game, 14);
      setTemperature(game, 8);
      maxOutOceans(game.players[0], 9);

      marsBot['bonusResolver'].advanceFurthestParameter();

      expect(game.getOxygenLevel()).eq(15);
      expect(game.board.getOceanSpaces()).has.length(9);
    });

    it('advances the temperature when it has the most steps left', () => {
      const {game, marsBot} = amazonisGame();
      setOxygenLevel(game, 17);
      setTemperature(game, 8);
      maxOutOceans(game.players[0], 10);

      marsBot['bonusResolver'].advanceFurthestParameter();

      expect(game.getTemperature()).eq(10);
      expect(game.board.getOceanSpaces()).has.length(10);
    });

    it('advances nothing once every parameter is at its maximum', () => {
      const {game, marsBot} = amazonisGame();
      setOxygenLevel(game, 18);
      setTemperature(game, 14);
      maxOutOceans(game.players[0], 11);

      expect(marsBot['bonusResolver'].advanceFurthestParameter()).is.false;
    });
  });

  describe('Government Intervention', () => {
    it('raises Venus at 30 on an odd generation', () => {
      const {game, marsBot} = amazonisGame(true);
      game.generation = 3;
      setVenusScaleLevel(game, 30);

      marsBot.resolveBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION);

      expect(game.getVenusScaleLevel()).eq(31);
    });

    it('falls through to Venus at 30 once every Martian parameter is at its maximum', () => {
      const {game, marsBot} = amazonisGame(true);
      game.generation = 4;
      setOxygenLevel(game, 18);
      setTemperature(game, 14);
      maxOutOceans(game.players[0], 11);
      setVenusScaleLevel(game, 30);

      marsBot.resolveBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION);

      expect(game.getVenusScaleLevel()).eq(31);
    });

    it('advances a Martian parameter on an even generation while one is below its maximum', () => {
      const {game, marsBot} = amazonisGame(true);
      game.generation = 4;
      setOxygenLevel(game, 14);
      setTemperature(game, 8);
      maxOutOceans(game.players[0], 9);
      setVenusScaleLevel(game, 30);

      marsBot.resolveBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION);

      expect(game.getOxygenLevel()).eq(15);
      expect(game.getVenusScaleLevel()).eq(30);
    });
  });

  describe('Lobbyists', () => {
    it('raises the temperature when it is 1 step from the maximum', () => {
      const {game, marsBot} = amazonisGame();
      setTemperature(game, 12);

      marsBot.resolveBonusCard(BonusCardId.B06_LOBBYISTS);

      expect(game.getTemperature()).eq(14);
    });

    it('raises oxygen when it is 2 steps from the maximum', () => {
      const {game, marsBot} = amazonisGame();
      setTemperature(game, -10);
      setOxygenLevel(game, 16);

      marsBot.resolveBonusCard(BonusCardId.B06_LOBBYISTS);

      expect(game.getOxygenLevel()).eq(18);
    });

    it('raises Venus when it is 2 steps from the maximum', () => {
      const {game, marsBot} = amazonisGame(true);
      setTemperature(game, 14);
      setOxygenLevel(game, 18);
      setVenusScaleLevel(game, 31);

      marsBot.resolveBonusCard(BonusCardId.B15_LOBBYISTS_VENUS);

      expect(game.getVenusScaleLevel()).eq(33);
    });
  });
});
