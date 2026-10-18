import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, setVenusScaleLevel} from '@tests/TestingUtils';

describe('probe misc: Venus 16% colony track bonus without Colonies', () => {
  it('no stuck input and no throw when Colonies is off', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true, coloniesExtension: false});
    setVenusScaleLevel(game, 14);
    game.increaseVenusScaleLevel(player, 1);
    runAllActions(game);
    expect(game.getVenusScaleLevel()).eq(16);
    expect(player.popWaitingFor()).is.undefined;
  });

  it('colony bonus prompts when Colonies is on', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true, coloniesExtension: true});
    setVenusScaleLevel(game, 14);
    game.increaseVenusScaleLevel(player, 1);
    runAllActions(game);
    expect(player.popWaitingFor()).is.not.undefined;
  });
});
