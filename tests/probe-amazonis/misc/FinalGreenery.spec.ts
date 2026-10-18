import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, setTemperature, setOxygenLevel, maxOutOceans} from '@tests/TestingUtils';
import {TileType} from '@/common/TileType';
import {Phase} from '@/common/Phase';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {SelectParty} from '@/server/inputs/SelectParty';
import {SelectResource} from '@/server/inputs/SelectResource';
import {PartyName} from '@/common/turmoil/PartyName';

describe('probe misc: Amazonis end of game', () => {
  for (const [label, targetsInit, pre] of [['wild resource', ['35'], undefined], ['double delegate and delegate', ['70', '72'], '71']] as Array<[string, Array<string>, string | undefined]>) {
  it(`final greenery on ${label} runs to game end without raising oxygen/TR`, () => {
    const [game, player, player2] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, turmoilExtension: true});
    setTemperature(game, 14);
    setOxygenLevel(game, 18);
    maxOutOceans(player, 11);
    runAllActions(game);
    player.plants = 24;
    player2.plants = 0;
    const tr = player.terraformRating;
    game.phase = Phase.PRODUCTION;
    game.takeNextFinalGreeneryAction();

    const targets = [...targetsInit];
    if (pre !== undefined) {
      game.simpleAddTile(player, game.board.getSpaceOrThrow(pre as any), {tileType: TileType.CITY});
    }
    for (let guard = 0; guard < 30 && game.phase !== Phase.END; guard++) {
      const wf = player.getWaitingFor();
      if (wf === undefined) {
        break;
      }
      if (wf instanceof OrOptions && wf.options[0] instanceof SelectSpace) {
        const target = targets.shift();
        if (target === undefined) {
          player.process({type: 'or', index: 1, response: {type: 'option'}});
        } else {
          player.process({type: 'or', index: 0, response: {type: 'space', spaceId: target as any}});
        }
      } else if (wf instanceof SelectResource) {
        player.process({type: 'resource', resource: 'steel'});
      } else if (wf instanceof SelectParty) {
        player.process({type: 'party', partyName: PartyName.MARS});
      } else {
        break;
      }
    }
    expect(game.phase).eq(Phase.END);
    expect(player.terraformRating).eq(tr);
    expect(game.getOxygenLevel()).eq(18);
  });
}
});
