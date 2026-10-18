import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceType} from '@/common/boards/SpaceType';
import {testGame} from '../../TestGame';
import {runAllActions} from '@tests/TestingUtils';
import {UnderworldExpansion} from '@/server/underworld/UnderworldExpansion';
import {Phase} from '@/common/Phase';

describe('probe underworld excavation on Amazonis', () => {
  it('BUG: excavating every space conserves tokens and does not crash', () => {
    const [game, player, player2] = testGame(2, {
      boardName: BoardName.AMAZONIS_PLANITIA,
      underworldExpansion: true,
      turmoilExtension: true,
    });
    game.phase = Phase.ACTION;
    const total = 136;
    const spaces = game.board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY);
    expect(spaces.length).eq(91);
    let i = 0;
    for (const space of spaces) {
      const p = i++ % 2 === 0 ? player : player2;
      p.megaCredits = 0;
      if (space.excavator === undefined) {
        UnderworldExpansion.excavate(p, space);
      }
      runAllActions(game);
      player.popWaitingFor();
      player2.popWaitingFor();
    }
    const onBoard = game.board.spaces.filter((s) => s.undergroundResources !== undefined).length;
    const claimed = player.underworldData.tokens.length + player2.underworldData.tokens.length;
    expect(onBoard + game.underworldData.tokens.length + claimed).eq(total);
    // every space excavated, so pile has 136 - 91 left
    expect(game.underworldData.tokens.length).eq(total - 91);
  });
});
