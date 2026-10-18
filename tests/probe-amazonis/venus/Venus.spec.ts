import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {Game} from '@/server/Game';
import {testGame} from '../../TestGame';
import {setVenusScaleLevel, runAllActions} from '@tests/TestingUtils';
import {Aphrodite} from '@/server/cards/venusNext/Aphrodite';
import {REDS_POLICY_3} from "@/server/turmoil/parties/Reds";
import {GlobalParameter} from "@/common/GlobalParameter";
import {Phase} from "@/common/Phase";
import {VenusRequirement} from '@/server/cards/requirements/VenusRequirement';

const opts = {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true};

describe('Amazonis venus probes', () => {
  const cases: Array<[number, 1 | 2 | 3, number, number]> = [
    // from, increments, expected level, expected steps
    [28, 3, 32, 3],
    [28, 2, 31, 2],
    [30, 2, 32, 2],
    [30, 3, 33, 3],
    [31, 3, 33, 2],
    [32, 3, 33, 1],
    [32, 2, 33, 1],
    [31, 1, 32, 1],
  ];
  for (const [from, inc, level, steps] of cases) {
    it(`raise ${inc} from ${from}: level ${level}, TR+${steps}, Aphrodite +${2 * steps}`, () => {
      const [game, player, player2] = testGame(2, opts);
      player2.playedCards.push(new Aphrodite());
      setVenusScaleLevel(game, from);
      const tr = player.terraformRating;
      const mc = player2.megaCredits;
      const r = game.increaseVenusScaleLevel(player, inc);
      runAllActions(game);
      expect(r).eq(steps);
      expect(game.getVenusScaleLevel()).eq(level);
      expect(player.terraformRating - tr).eq(steps);
      expect(player2.megaCredits - mc).eq(2 * steps);
    });
  }

  it('lower from 31 -> 30, 32 -> 31, 30 -> 28', () => {
    const [game, player] = testGame(2, opts);
    setVenusScaleLevel(game, 31);
    game.increaseVenusScaleLevel(player, -1);
    expect(game.getVenusScaleLevel()).eq(30);
    setVenusScaleLevel(game, 32);
    game.increaseVenusScaleLevel(player, -1);
    expect(game.getVenusScaleLevel()).eq(31);
    setVenusScaleLevel(game, 30);
    game.increaseVenusScaleLevel(player, -1);
    expect(game.getVenusScaleLevel()).eq(28);
  });

  it('lower then re-raise crosses TR threshold 22 correctly', () => {
    const [game, player] = testGame(2, opts);
    setVenusScaleLevel(game, 22);
    game.increaseVenusScaleLevel(player, -1);
    expect(game.getVenusScaleLevel()).eq(20);
    const tr = player.terraformRating;
    game.increaseVenusScaleLevel(player, 1);
    runAllActions(game);
    // 20 -> 22 crosses TR bonus: +1 step +1 bonus
    expect(player.terraformRating - tr).eq(2);
  });

  it('serialize/deserialize round trip at 31 and 33', () => {
    for (const lvl of [31, 33]) {
      const [game] = testGame(2, opts);
      setVenusScaleLevel(game, lvl);
      const d = Game.deserialize(game.serialize());
      expect(d.getVenusScaleLevel()).eq(lvl);
      expect(d.max.venus).eq(33);
    }
  });

  it('Reds P3 can decrease Venus at 32 but not at 33', () => {
    const [game] = testGame(2, opts);
    setVenusScaleLevel(game, 32);
    expect((REDS_POLICY_3 as any).canDecrease(game, GlobalParameter.VENUS)).is.true;
    setVenusScaleLevel(game, 33);
    expect((REDS_POLICY_3 as any).canDecrease(game, GlobalParameter.VENUS)).is.false;
  });

  it('Venus requirement: min 30 satisfied at 31/33, not at 28', () => {
    const [game, player] = testGame(2, opts);
    const req = new VenusRequirement({count: 30});
    setVenusScaleLevel(game, 28);
    expect(req.satisfies(player, {} as any)).is.false;
    setVenusScaleLevel(game, 31);
    expect(req.satisfies(player, {} as any)).is.true;
    setVenusScaleLevel(game, 33);
    expect(req.satisfies(player, {} as any)).is.true;
  });

  it('Venus requirement: max 20 not satisfied at 31', () => {
    const [game, player] = testGame(2, opts);
    const req = new VenusRequirement({count: 20, max: true});
    setVenusScaleLevel(game, 31);
    expect(req.satisfies(player, {} as any)).is.false;
  });

  it('WGT: at 32 offers Venus; raising reaches 33; at 33 no Venus option', () => {
    const [game, player] = testGame(2, opts);
    setVenusScaleLevel(game, 32);
    game.phase = Phase.SOLAR;
    const or = game.worldGovernmentTerraformingInput(player);
    const venus = or.options.find((o) => o.title.toString() === 'Increase Venus scale');
    expect(venus).not.undefined;
    (venus as any).cb();
    expect(game.getVenusScaleLevel()).eq(33);

    const or2 = game.worldGovernmentTerraformingInput(player);
    expect(or2.options.find((o) => o.title.toString() === 'Increase Venus scale')).is.undefined;
  });

  it('Solo: not terraformed until Venus is 33', () => {
    const [game] = testGame(1, {...opts, soloTR: false});
    (game as any).temperature = game.max.temperature;
    (game as any).oxygenLevel = game.max.oxygen;
    while (game.board.getOceanSpaces().length < game.max.oceans) {
      const p = game.players[0];
      game.addOcean(p, game.board.getAvailableSpacesForOcean(p)[0]);
    }
    setVenusScaleLevel(game, 30);
    expect(game.marsIsTerraformed()).is.false;
    setVenusScaleLevel(game, 32);
    expect(game.marsIsTerraformed()).is.false;
    setVenusScaleLevel(game, 33);
    expect(game.marsIsTerraformed()).is.true;
  });
});
