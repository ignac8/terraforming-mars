import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Coastguard, Irrigator} from '../../src/server/milestones/Irrigator';
import {addCity, addGreenery, maxOutOceans} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {BoardName} from '@/common/boards/BoardName';
import {Board} from '@/server/boards/Board';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {fakeMarsBot} from '../automa/FakeMarsBot';

describe('Irrigator', () => {
  let milestone: Irrigator;
  let player: TestPlayer;

  beforeEach(() => {
    milestone = new Irrigator();
    [/* game */, player] = testGame(2);

    maxOutOceans(player);
  });

  it('Can claim with 4 tiles adjacent to oceans', () => {
    addCity(player, '09');
    addGreenery(player, '20');
    addCity(player, '11');
    expect(milestone.canClaim(player)).is.false;

    addGreenery(player, '24');
    expect(milestone.canClaim(player)).is.true;
  });

  it('Coastguard: MarsBot needs 3 tiles next to oceans on Terra Cimmeria and 4 elsewhere', () => {
    const terraCimmeria = {boardName: BoardName.TERRA_CIMMERIA_NOVA};
    const expansion = {boardName: BoardName.TERRA_CIMMERIA_NOVA, modularMA: true};

    for (const run of [
      {gameOptions: terraCimmeria, tiles: 3, expected: true},
      {gameOptions: expansion, tiles: 3, expected: false},
      {gameOptions: expansion, tiles: 4, expected: true},
    ]) {
      const bot = fakeMarsBot({gameOptions: run.gameOptions});
      const board = bot.game.board;
      maxOutOceans(bot.player);
      for (let i = 0; i < run.tiles; i++) {
        const space = board.getAvailableSpacesOnLand(bot.player)
          .find((space) => board.getAdjacentSpaces(space).some(Board.isOceanSpace));
        addGreenery(bot.player, space?.id);
      }

      expect(marsBotCanClaimMilestone(new Coastguard(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
