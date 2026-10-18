import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions} from '@tests/TestingUtils';
import {cast} from '@/common/utils/utils';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {SelectResource} from '@/server/inputs/SelectResource';
import {MiningGuild} from '@/server/cards/corporation/MiningGuild';
import {SurveyMission} from '@/server/cards/pathfinders/SurveyMission';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {Space} from '@/server/boards/Space';
import {IGame} from '@/server/IGame';

const opts = {boardName: BoardName.AMAZONIS_PLANITIA, pathfindersExpansion: true};

function triangleWith(game: IGame, id: string): [Space, Space, Space] {
  const board = game.board;
  const s = board.getSpaceOrThrow(id as any);
  const adj = board.getAdjacentSpaces(s).filter((a) => a.spaceType === s.spaceType);
  for (const a of adj) {
    for (const b of adj) {
      if (a !== b && board.getAdjacentSpaces(a).includes(b)) {
        return [s, a, b];
      }
    }
  }
  throw new Error('no triangle');
}

describe('probe: Survey Mission + Mining Guild on Amazonis', () => {
  it('control: claiming a steel-bonus space gives Mining Guild production', () => {
    const [game, player] = testGame(1, opts);
    player.playedCards.push(new MiningGuild());
    const steelSpace = game.board.spaces.find((s) => s.spaceType === 'land' && s.bonus.length === 1 && s.bonus[0] === SpaceBonus.STEEL)!;
    const tri = triangleWith(game, steelSpace.id);
    const sel = cast(new SurveyMission().play(player), SelectSpace);
    sel.cb(tri[0]);
    runAllActions(game);
    // drain remaining prompts
    expect(player.production.steel).eq(1);
  });

  it('BUG: claiming standard-resource space 35 and choosing steel gives no Mining Guild production (placing a tile there would)', () => {
    const [game, player] = testGame(1, opts);
    player.playedCards.push(new MiningGuild());
    const tri = triangleWith(game, '35');
    const sel = cast(new SurveyMission().play(player), SelectSpace);
    sel.cb(tri[0]);
    runAllActions(game);
    const sr = cast(player.popWaitingFor(), SelectResource);
    sr.cb('steel');
    runAllActions(game);
    expect(player.production.steel).eq(1);
  });
});
