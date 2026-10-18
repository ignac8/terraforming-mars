import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {Phase} from '@/common/Phase';
import {testGame} from '@tests/TestGame';
import {cast} from '@/common/utils/utils';
import {SelectColony} from '@/server/inputs/SelectColony';
import {runAllActions, setVenusScaleLevel} from '@tests/TestingUtils';
import {Game} from '@/server/Game';
import {ColonyName} from '@/common/colonies/ColonyName';

describe('Amazonis tracks probes 2', () => {
  it('BUG: serialize/deserialize keeps Amazonis tracks', () => {
    const [game] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true});
    const g2 = Game.deserialize(game.serialize());
    expect(g2.globalParameterTracks).deep.eq(game.globalParameterTracks);
    expect(g2.globalParameterTracks.oxygen.length).eq(2);
    expect(g2.max).deep.eq(game.max);
  });

  for (const name of Object.values(ColonyName)) {
    it('BUG: Venus 16 colony bonus -> choosing ' + name + ' does not throw', () => {
      const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      setVenusScaleLevel(game, 14);
      game.increaseVenusScaleLevel(player, 1);
      runAllActions(game);
      const select = cast(player.popWaitingFor(), SelectColony);
      const c = select.colonies.find((c) => c.name === name);
      if (c === undefined) return;
      select.cb(c);
      runAllActions(game);
      expect(c.colonies).deep.eq([player.id]);
    });
  }

  it('BUG: alt venus forced on Amazonis, 28->32->33 grants sane bonuses', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true, altVenusBoard: true});
    game.phase = Phase.ACTION;
    setVenusScaleLevel(game, 28);
    game.increaseVenusScaleLevel(player, 3); // 28 -> 32
    runAllActions(game);
    const input = player.popWaitingFor();
    console.log('ALT 28->32', input?.constructor.name, (input as any)?.count);
    expect(input).is.not.undefined;
    setVenusScaleLevel(game, 32);
    game.increaseVenusScaleLevel(player, 1);
    runAllActions(game);
    const input2 = player.popWaitingFor();
    console.log('ALT 32->33', input2?.constructor.name);
  });
});
