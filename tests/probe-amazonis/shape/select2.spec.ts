import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {DEFAULT_GAME_OPTIONS} from '@/server/game/GameOptions';
import {chooseMilestonesAndAwards} from '@/server/ma/MilestoneAwardSelector';
import {synergies} from '@/server/ma/MilestoneAwardSynergies';

describe('probe shape: random M&A is board independent (pre-existing)', () => {
  for (const boardName of [BoardName.THARSIS, BoardName.AMAZONIS_PLANITIA]) {
    for (const [randomMA, modularMA, includeFanMA] of [
      [RandomMAOptionType.LIMITED, false, true],
      [RandomMAOptionType.LIMITED, true, false],
      [RandomMAOptionType.UNLIMITED, true, false],
    ] as const) {
      it(`BUG: ${boardName} randomMA=${randomMA} modular=${modularMA} fan=${includeFanMA} never throws (500 draws)`, () => {
        let failures = 0;
        for (let i = 0; i < 500; i++) {
          try {
            chooseMilestonesAndAwards({...DEFAULT_GAME_OPTIONS, boardName, randomMA, modularMA, includeFanMA, venusNextExtension: true});
          } catch (e) {
            failures++;
          }
        }
        expect(failures).eq(0);
      });
    }
  }

  it('BUG: synergy map is symmetric', () => {
    const asym: Array<string> = [];
    const names = [...(synergies as any).map.keys()] as Array<string>;
    for (const k of names) {
      const [a, b] = k.split('|');
      if ((synergies as any).map.get(b + '|' + a) !== (synergies as any).map.get(k)) asym.push(k);
    }
    expect(asym.slice(0, 5)).deep.eq([]);
  });
});
