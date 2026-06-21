import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {testGame} from '../TestGame';
import {setVenusScaleLevel} from '../TestingUtils';
import {Phase} from '../../src/common/Phase';

describe('AmazonisBigBoard parameters', () => {
  it('a game on the big board reports the extended maxes', () => {
    const [game] = testGame(2, {boardName: BoardName.AMAZONIS_BIG, venusNextExtension: true});
    expect(game.maxTemperature).eq(14);
    expect(game.maxOxygenLevel).eq(18);
    expect(game.maxOceanTiles).eq(11);
    expect(game.maxVenusScale).eq(33);
  });

  it('a Tharsis game still reports the standard maxes', () => {
    const [game] = testGame(2, {boardName: BoardName.THARSIS, venusNextExtension: true});
    expect(game.maxTemperature).eq(8);
    expect(game.maxOxygenLevel).eq(14);
    expect(game.maxOceanTiles).eq(9);
    expect(game.maxVenusScale).eq(30);
  });

  it('raising Venus from 30 by one step lands on 31 and grants 1 TR on the big board', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_BIG, venusNextExtension: true});
    setVenusScaleLevel(game, 30);
    const tr = player.terraformRating;

    const steps = game.increaseVenusScaleLevel(player, 1);

    expect(steps).eq(1);
    expect(game.getVenusScaleLevel()).eq(31);
    expect(player.terraformRating).eq(tr + 1);
  });

  it('three single steps walk 30 -> 31 -> 32 -> 33 then stop at max', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_BIG, venusNextExtension: true});
    setVenusScaleLevel(game, 30);
    const tr = player.terraformRating;

    expect(game.increaseVenusScaleLevel(player, 1)).eq(1);
    expect(game.getVenusScaleLevel()).eq(31);
    expect(game.increaseVenusScaleLevel(player, 1)).eq(1);
    expect(game.getVenusScaleLevel()).eq(32);
    expect(game.increaseVenusScaleLevel(player, 1)).eq(1);
    expect(game.getVenusScaleLevel()).eq(33);
    // Already maxed, no further movement.
    expect(game.increaseVenusScaleLevel(player, 1)).eq(0);
    expect(game.getVenusScaleLevel()).eq(33);
    expect(player.terraformRating).eq(tr + 3);
  });

  it('a multi-step raise from 30 walks the 1% fields and grants 1 TR per field', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_BIG, venusNextExtension: true});
    setVenusScaleLevel(game, 30);
    const tr = player.terraformRating;

    const steps = game.increaseVenusScaleLevel(player, 3);

    expect(steps).eq(3);
    expect(game.getVenusScaleLevel()).eq(33);
    expect(player.terraformRating).eq(tr + 3);
  });

  it('Reds P3 -1 decrement removes one field at the extended top (32 -> 31)', () => {
    // Reds P3 canDecrease blocks a decrement once Venus is at its max, so the realistic
    // scenario is decrementing within the 1% region: 32 -> 31 (one field, not 2%).
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_BIG, venusNextExtension: true});
    setVenusScaleLevel(game, 32);

    game.increaseVenusScaleLevel(player, -1);

    expect(game.getVenusScaleLevel()).eq(31);
  });

  it('Reds P3 -1 decrement at the boundary moves 31 -> 30 (into the 2% region)', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_BIG, venusNextExtension: true});
    setVenusScaleLevel(game, 31);

    game.increaseVenusScaleLevel(player, -1);

    expect(game.getVenusScaleLevel()).eq(30);
  });

  it('Reds P3 -1 decrement still removes 2% below 30', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_BIG, venusNextExtension: true});
    setVenusScaleLevel(game, 20);

    game.increaseVenusScaleLevel(player, -1);

    expect(game.getVenusScaleLevel()).eq(18);
  });

  it('on a standard board Venus still moves by 2% per step', () => {
    const [game, player] = testGame(2, {boardName: BoardName.THARSIS, venusNextExtension: true});
    setVenusScaleLevel(game, 20);
    const tr = player.terraformRating;

    const steps = game.increaseVenusScaleLevel(player, 1);

    expect(steps).eq(1);
    expect(game.getVenusScaleLevel()).eq(22);
    expect(player.terraformRating).eq(tr + 1);
  });

  it('marsIsTerraformed only fires at the extended thresholds on the big board', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_BIG, venusNextExtension: true});

    // The standard maxes are NOT terraformed on this board.
    (game as any).temperature = 8;
    (game as any).oxygenLevel = 14;
    setVenusScaleLevel(game, 30);
    // Fill standard count of oceans but not the extended max.
    for (let i = 0; i < 9; i++) {
      game.addOcean(player, game.board.getAvailableSpacesForOcean(player)[0]);
    }
    expect(game.marsIsTerraformed()).is.false;

    // Now push to the extended maxes.
    (game as any).temperature = 14;
    (game as any).oxygenLevel = 18;
    setVenusScaleLevel(game, 33);
    while (game.canAddOcean()) {
      game.addOcean(player, game.board.getAvailableSpacesForOcean(player)[0]);
    }
    expect(game.marsIsTerraformed()).is.true;
  });

  it('the game does not end at the standard Venus max if the big board can go higher', () => {
    const [game, player, player2] = testGame(2, {boardName: BoardName.AMAZONIS_BIG, venusNextExtension: true, requiresVenusTrackCompletion: true});
    (game as any).temperature = 14;
    (game as any).oxygenLevel = 18;
    setVenusScaleLevel(game, 30);
    while (game.canAddOcean()) {
      game.addOcean(player, game.board.getAvailableSpacesForOcean(player)[0]);
    }
    player.plants = 0;
    player2.plants = 0;
    game.playerHasPassed(player);
    game.playerHasPassed(player2);
    game.playerIsFinishedTakingActions();
    // Venus only at 30 (standard max) but big board max is 33, so the game must not be over.
    expect(game.phase).to.eq(Phase.RESEARCH);
  });
});
