import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {Phase} from '@/common/Phase';
import {testGame} from '@tests/TestGame';
import {TestPlayer} from '@tests/TestPlayer';
import {IGame} from '@/server/IGame';
import {cast} from '@/common/utils/utils';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {SelectColony} from '@/server/inputs/SelectColony';
import {maxOutOceans, runAllActions, setOxygenLevel, setTemperature, setVenusScaleLevel} from '@tests/TestingUtils';

function amazonis(players: number, opts: Record<string, unknown> = {}): [IGame, ...Array<TestPlayer>] {
  const r = testGame(players, {boardName: BoardName.AMAZONIS_PLANITIA, ...opts});
  r[0].phase = Phase.ACTION;
  return r;
}

describe('Amazonis tracks probes', () => {
  describe('colony bonus', () => {
    it('BUG: colony bonus with every colony tile full does not prompt / throw', () => {
      const [game, player, other] = amazonis(2, {venusNextExtension: true, coloniesExtension: true});
      for (const colony of game.colonies) {
        while (!colony.isFull()) colony.colonies.push(other.id);
      }
      setVenusScaleLevel(game, 14);
      game.increaseVenusScaleLevel(player, 1);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
    });

    it('BUG: colony bonus when player already has a colony on every tile does not prompt', () => {
      const [game, player] = amazonis(2, {venusNextExtension: true, coloniesExtension: true});
      for (const colony of game.colonies) {
        colony.colonies.push(player.id);
      }
      setVenusScaleLevel(game, 14);
      game.increaseVenusScaleLevel(player, 1);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
    });

    it('BUG: colony bonus prompt then selecting a colony gives colony + bonus (colonies on)', () => {
      const [game, player] = amazonis(2, {venusNextExtension: true, coloniesExtension: true});
      setVenusScaleLevel(game, 14);
      game.increaseVenusScaleLevel(player, 1);
      runAllActions(game);
      const select = cast(player.popWaitingFor(), SelectColony);
      expect(select.colonies.length).gt(0);
    });

    it('BUG: Venus raise of 2 steps 14->18 grants exactly one colony prompt', () => {
      const [game, player] = amazonis(2, {venusNextExtension: true, coloniesExtension: true});
      setVenusScaleLevel(game, 14);
      const tr = player.terraformRating;
      game.increaseVenusScaleLevel(player, 2);
      expect(game.getVenusScaleLevel()).eq(18);
      expect(player.terraformRating).eq(tr + 2);
      expect(game.deferredActions.length).eq(1);
    });

    it('BUG: Venus 20->22 grants TR bonus (extra +1)', () => {
      const [game, player] = amazonis(2, {venusNextExtension: true, coloniesExtension: true});
      setVenusScaleLevel(game, 20);
      const tr = player.terraformRating;
      game.increaseVenusScaleLevel(player, 1);
      expect(game.getVenusScaleLevel()).eq(22);
      expect(player.terraformRating).eq(tr + 2);
    });

    it('BUG: Venus 28 +3 steps lands on 32, crossing nothing, TR +3', () => {
      const [game, player] = amazonis(2, {venusNextExtension: true, coloniesExtension: true});
      setVenusScaleLevel(game, 28);
      const tr = player.terraformRating;
      game.increaseVenusScaleLevel(player, 3);
      expect(game.getVenusScaleLevel()).eq(32);
      expect(player.terraformRating).eq(tr + 3);
    });

    it('BUG: Venus 14 +3 steps -> 20 only one colony, no TR bonus', () => {
      const [game, player] = amazonis(2, {venusNextExtension: true, coloniesExtension: true});
      setVenusScaleLevel(game, 14);
      const tr = player.terraformRating;
      game.increaseVenusScaleLevel(player, 3);
      expect(game.getVenusScaleLevel()).eq(20);
      expect(player.terraformRating).eq(tr + 3);
      expect(game.deferredActions.length).eq(1);
    });

    it('BUG: Venus 6 +3 steps -> 12 draws exactly one card', () => {
      const [game, player] = amazonis(2, {venusNextExtension: true, coloniesExtension: true});
      setVenusScaleLevel(game, 6);
      const before = player.cardsInHand.length;
      game.increaseVenusScaleLevel(player, 3);
      expect(player.cardsInHand.length).eq(before + 1);
    });

    it('BUG: colony from Venus bonus in solar phase is skipped, but game does not break', () => {
      const [game, player] = amazonis(2, {venusNextExtension: true, coloniesExtension: true});
      game.phase = Phase.SOLAR;
      setVenusScaleLevel(game, 14);
      const tr = player.terraformRating;
      game.increaseVenusScaleLevel(player, 3);
      runAllActions(game);
      expect(player.terraformRating).eq(tr);
      expect(player.popWaitingFor()).is.undefined;
    });
  });

  describe('temperature multi-step', () => {
    it('BUG: -30 +3 steps crosses -24 -> heat +1', () => {
      const [game, player] = amazonis(1);
      setTemperature(game, -30);
      game.increaseTemperature(player, 3);
      expect(game.getTemperature()).eq(-24);
      expect(player.production.heat).eq(1);
    });
    it('BUG: -26 +3 steps crosses -24 and -20 -> heat +2', () => {
      const [game, player] = amazonis(1);
      setTemperature(game, -26);
      game.increaseTemperature(player, 3);
      expect(game.getTemperature()).eq(-20);
      expect(player.production.heat).eq(2);
    });
    it('BUG: -14 +3 steps crosses -12 -> plant +1', () => {
      const [game, player] = amazonis(1);
      setTemperature(game, -14);
      game.increaseTemperature(player, 3);
      expect(game.getTemperature()).eq(-8);
      expect(player.production.plants).eq(1);
    });
    it('BUG: -4 +3 steps crosses 0 -> ocean prompt only once', () => {
      const [game, player] = amazonis(2);
      setTemperature(game, -4);
      game.increaseTemperature(player, 3);
      expect(game.getTemperature()).eq(2);
      expect(game.deferredActions.length).eq(1);
      runAllActions(game);
      cast(player.popWaitingFor(), SelectSpace);
    });
    it('BUG: temp clamps at 14 and lowest bonus not repeated', () => {
      const [game, player] = amazonis(1);
      setTemperature(game, 12);
      game.increaseTemperature(player, 3);
      expect(game.getTemperature()).eq(14);
      expect(player.production.heat).eq(0);
      expect(player.production.plants).eq(0);
    });
  });

  describe('oxygen', () => {
    it('BUG: oxygen 6 +2 crossing 7 draws exactly one card', () => {
      const [game, player] = amazonis(1);
      setOxygenLevel(game, 6);
      const before = player.cardsInHand.length;
      game.increaseOxygenLevel(player, 2);
      expect(game.getOxygenLevel()).eq(8);
      expect(player.cardsInHand.length).eq(before + 1);
    });
    it('BUG: oxygen 10 +2 crossing 11 raises temp one step', () => {
      const [game, player] = amazonis(1);
      setOxygenLevel(game, 10);
      setTemperature(game, -10);
      game.increaseOxygenLevel(player, 2);
      expect(game.getOxygenLevel()).eq(12);
      expect(game.getTemperature()).eq(-8);
    });
    it('BUG: oxygen cascade crosses temp 0 -> ocean prompt to same player, TR counts', () => {
      const [game, player, other] = amazonis(2);
      setOxygenLevel(game, 10);
      setTemperature(game, -2);
      const tr = player.terraformRating;
      const otherTr = other.terraformRating;
      game.increaseOxygenLevel(player, 1);
      expect(game.getTemperature()).eq(0);
      expect(player.terraformRating).eq(tr + 2);
      expect(other.terraformRating).eq(otherTr);
      runAllActions(game);
      const sel = cast(player.popWaitingFor(), SelectSpace);
      sel.cb(sel.spaces[0]);
      expect(player.terraformRating).eq(tr + 3);
    });
    it('BUG: oxygen cascade crossing -12 gives plant production to raiser (player 2 active)', () => {
      const [game, p1, p2] = amazonis(2);
      game.activePlayer = p2;
      setOxygenLevel(game, 10);
      setTemperature(game, -14);
      game.increaseOxygenLevel(p2, 1);
      expect(game.getTemperature()).eq(-12);
      expect(p2.production.plants).eq(1);
      expect(p1.production.plants).eq(0);
    });
    it('BUG: oxygen 11 crossing with temperature maxed does not throw / loop', () => {
      const [game, player] = amazonis(1);
      setOxygenLevel(game, 10);
      setTemperature(game, 14);
      const tr = player.terraformRating;
      game.increaseOxygenLevel(player, 1);
      expect(game.getTemperature()).eq(14);
      expect(player.terraformRating).eq(tr + 1);
    });
    it('BUG: oxygen cascade -> temp 0 with oceans maxed does not prompt', () => {
      const [game, player] = amazonis(1);
      maxOutOceans(player, 11);
      setOxygenLevel(game, 10);
      setTemperature(game, -2);
      game.increaseOxygenLevel(player, 1);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
    });
    it('BUG: oxygen cascade where temperature step crosses -24 and also 0 wanted? heat given', () => {
      const [game, player] = amazonis(1);
      setOxygenLevel(game, 10);
      setTemperature(game, -26);
      game.increaseOxygenLevel(player, 1);
      expect(game.getTemperature()).eq(-24);
      expect(player.production.heat).eq(1);
    });
  });

  describe('solar', () => {
    it('BUG: solar temperature -2 -> 0 still places an ocean, with no TR', () => {
      const [game, player] = amazonis(2);
      game.phase = Phase.SOLAR;
      setTemperature(game, -2);
      const tr = player.terraformRating;
      game.increaseTemperature(player, 1);
      runAllActions(game);
      const sel = cast(player.popWaitingFor(), SelectSpace);
      const space = sel.spaces[0];
      sel.cb(space);
      expect(space.tile?.tileType).is.not.undefined;
      expect(player.terraformRating).eq(tr);
    });
    it('BUG: solar oxygen 10 -> 11 cascade temp -2 -> 0 ocean', () => {
      const [game, player] = amazonis(2);
      game.phase = Phase.SOLAR;
      setOxygenLevel(game, 10);
      setTemperature(game, -2);
      game.increaseOxygenLevel(player, 1);
      expect(game.getTemperature()).eq(0);
      runAllActions(game);
      cast(player.popWaitingFor(), SelectSpace);
    });
    it('BUG: solar Venus 28 +3 to 32 works', () => {
      const [game, player] = amazonis(2, {venusNextExtension: true});
      game.phase = Phase.SOLAR;
      setVenusScaleLevel(game, 28);
      const tr = player.terraformRating;
      game.increaseVenusScaleLevel(player, 3);
      expect(game.getVenusScaleLevel()).eq(32);
      expect(player.terraformRating).eq(tr);
    });
  });

  describe('decreases', () => {
    it('BUG: decrease then re-raise 7->6->7 oxygen draws card again (rules: bonus re-triggers)', () => {
      const [game, player] = amazonis(1);
      setOxygenLevel(game, 7);
      game.increaseOxygenLevel(player, -1);
      expect(game.getOxygenLevel()).eq(6);
      const before = player.cardsInHand.length;
      game.increaseOxygenLevel(player, 1);
      expect(player.cardsInHand.length).eq(before + 1);
    });
    it('Venus decrease from 32 -> 31 -> 30 -> 28 -> 26', () => {
      const [game, player] = amazonis(1, {venusNextExtension: true});
      setVenusScaleLevel(game, 32);
      const seq: Array<number> = [];
      for (let i = 0; i < 4; i++) {
        game.increaseVenusScaleLevel(player, -1);
        seq.push(game.getVenusScaleLevel());
      }
      expect(seq).deep.eq([31, 30, 28, 26]);
    });
  });
});
