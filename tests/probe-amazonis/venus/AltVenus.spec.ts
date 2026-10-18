import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {setVenusScaleLevel} from '@tests/TestingUtils';
import {IGame} from '@/server/IGame';
import {GrantVenusAltTrackBonusDeferred} from '@/server/venusNext/GrantVenusAltTrackBonusDeferred';
import {GainResources} from '@/server/inputs/GainResources';
import {cast} from '@/common/utils/utils';

const opts = {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true, altVenusBoard: true};

function grants(game: IGame) {
  const out: Array<{standardResourceCount: number, wildResource: boolean}> = [];
  let d;
  while ((d = game.deferredActions.pop()) !== undefined) {
    if (d instanceof GrantVenusAltTrackBonusDeferred) {
      out.push({standardResourceCount: d.standardResourceCount, wildResource: d.wildResource});
    }
  }
  return out;
}

describe('Amazonis + altVenusBoard probes', () => {
  it('BUG: crossing 28 -> 30 should grant the printed std + wild resources at the 30 space (client overlay draws p30 + p30b at level 30)', () => {
    const [game, player] = testGame(2, opts);
    setVenusScaleLevel(game, 28);
    game.increaseVenusScaleLevel(player, 1);
    expect(grants(game)).deep.eq([{standardResourceCount: 1, wildResource: true}]);
  });

  it('BUG: 30 -> 31 grants a standard resource although the alt board has no icon past 30', () => {
    const [game, player] = testGame(2, opts);
    setVenusScaleLevel(game, 30);
    game.increaseVenusScaleLevel(player, 1);
    expect(grants(game)).deep.eq([]);
  });

  it('BUG: 30 -> 33 (one 3-step raise) grants 3 std resources past the printed track', () => {
    const [game, player] = testGame(2, opts);
    setVenusScaleLevel(game, 30);
    game.increaseVenusScaleLevel(player, 3);
    // Printed alt board ends at 30, so nothing should be granted above 30.
    expect(grants(game)).deep.eq([]);
  });

  it('BUG (also Tharsis, not Amazonis-specific): wild resource with no resource card is dropped', () => {
    const [, player] = testGame(2, {altVenusBoard: true});
    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 1, true).execute(), GainResources);
    // 1 standard + 1 wild (which becomes a standard resource when no card can hold it) = 2.
    expect(input.count).eq(2);
  });
});
