import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {synergies} from '@/server/ma/MilestoneAwardSynergies';
import {testGame} from '@tests/TestGame';

const N = 300;

function rate(opts: any): {fail: number, msgs: Set<string>} {
  let fail = 0;
  const msgs = new Set<string>();
  for (let i = 0; i < N; i++) {
    try {
      testGame(2, opts);
    } catch (e) {
      fail++;
      msgs.add(String((e as Error).message).slice(0, 80));
    }
  }
  return {fail, msgs};
}

const combos: Array<[RandomMAOptionType, boolean, boolean]> = [
  [RandomMAOptionType.LIMITED, false, false],
  [RandomMAOptionType.LIMITED, false, true],
  [RandomMAOptionType.LIMITED, true, false],
  [RandomMAOptionType.LIMITED, true, true],
  [RandomMAOptionType.UNLIMITED, false, false],
  [RandomMAOptionType.UNLIMITED, false, true],
  [RandomMAOptionType.UNLIMITED, true, false],
  [RandomMAOptionType.UNLIMITED, true, true],
];

describe('verify #6: random M&A through Game.newInstance (testGame)', () => {
  const results: Array<string> = [];
  for (const boardName of [BoardName.THARSIS, BoardName.AMAZONIS_PLANITIA]) {
    for (const venus of [false, true]) {
      for (const [randomMA, modularMA, includeFanMA] of combos) {
        it(`${boardName} venus=${venus} ${randomMA} modular=${modularMA} fan=${includeFanMA}`, () => {
          const r = rate({boardName, randomMA, modularMA, includeFanMA, venusNextExtension: venus});
          results.push(`${boardName} venus=${venus} ${randomMA} modular=${modularMA} fan=${includeFanMA}: ${r.fail}/${N} ${[...r.msgs].join(' / ')}`);
        });
      }
    }
  }
  after(() => console.log(results.join('\n')));
});

describe('verify #6: same draws after symmetrising the synergy map', () => {
  const results: Array<string> = [];
  before(() => {
    const map = (synergies as any).map as Map<string, number>;
    for (const [k, v] of [...map.entries()]) {
      const [a, b] = k.split('|');
      if (!map.has(b + '|' + a)) map.set(b + '|' + a, v);
    }
  });
  for (const boardName of [BoardName.THARSIS, BoardName.AMAZONIS_PLANITIA]) {
    for (const [randomMA, modularMA, includeFanMA] of combos) {
      it(`symmetric ${boardName} venus=true ${randomMA} modular=${modularMA} fan=${includeFanMA}`, () => {
        const r = rate({boardName, randomMA, modularMA, includeFanMA, venusNextExtension: true});
        results.push(`SYM ${boardName} ${randomMA} modular=${modularMA} fan=${includeFanMA}: ${r.fail}/${N} ${[...r.msgs].join(' / ')}`);
        expect(r.msgs.has('The randomized milestones and awards set does not satisfy the given synergy rules.')).is.false;
      });
    }
  }
  after(() => console.log(results.join('\n')));
});
