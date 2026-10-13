import {expect} from 'chai';
import {allSynergyRows, sameScoreAs, synergies} from '../../src/server/ma/MilestoneAwardSynergies';
import {chooseMilestonesAndAwards, getCandidates, LIMITED_SYNERGY} from '../../src/server/ma/MilestoneAwardSelector';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../src/server/game/GameOptions';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {milestoneNames} from '../../src/common/ma/MilestoneName';
import {awardNames} from '../../src/common/ma/AwardName';

describe('MilestoneAwardSynergies', () => {
  const allExpansions: GameOptions['expansions'] = {...DEFAULT_GAME_OPTIONS.expansions};
  for (const expansion of Object.keys(allExpansions) as Array<keyof GameOptions['expansions']>) {
    allExpansions[expansion] = true;
  }
  const everything: GameOptions = {
    ...DEFAULT_GAME_OPTIONS,
    expansions: allExpansions,
    venusNextExtension: true,
    aresExtension: true,
    moonExpansion: true,
    coloniesExtension: true,
    turmoilExtension: true,
    randomMA: RandomMAOptionType.LIMITED,
  };
  const pools = [
    {name: 'official', options: {...everything, includeFanMA: false}},
    {name: 'fan', options: {...everything, includeFanMA: true}},
    {name: 'modular', options: {...everything, modularMA: true}},
  ];

  it('No pair is listed twice with different weights', () => {
    const seen = new Map<string, number>();
    for (const [a, b, weight] of allSynergyRows) {
      const key = [a, b].sort().join('|');
      const previous = seen.get(key);
      if (previous !== undefined) {
        expect(weight, key).eq(previous);
      }
      seen.set(key, weight);
    }
  });

  for (const pool of pools) {
    it(`Every ${pool.name} candidate can fit into a limited synergy draw`, () => {
      // A draw has 12 milestones and awards with Venus, so each one sits next to 11 others. If even
      // its 11 lowest synergies add up past the limit, it can never be drawn.
      const candidates: Array<string> = getCandidates(pool.options).flat();
      for (const candidate of candidates) {
        const lowest = candidates
          .filter((other) => other !== candidate)
          .map((other) => synergies.get(candidate, other))
          .sort((a, b) => a - b)
          .slice(0, 11);
        const total = lowest.reduce((sum, weight) => sum + weight, 0);
        expect(total, candidate).lte(LIMITED_SYNERGY.totalSynergyAllowed);
      }
    });

    it(`Limited synergy draws from the ${pool.name} pool succeed`, () => {
      for (let idx = 0; idx < 200; idx++) {
        const mas = chooseMilestonesAndAwards(pool.options);
        expect(mas.milestones).to.have.length(6);
        expect(mas.awards).to.have.length(6);
      }
    });
  }

  it('Copies share every synergy of the original', () => {
    const all: Array<string> = [...milestoneNames, ...awardNames];
    for (const [copy, original] of sameScoreAs) {
      expect(synergies.get(copy, original), copy).eq(9);
      const copiesOfOriginal = sameScoreAs.filter((entry) => entry[1] === original).map((entry) => entry[0]);
      for (const other of all) {
        if (other === copy || other === original || copiesOfOriginal.includes(other as typeof copy)) {
          continue;
        }
        expect(synergies.get(copy, other), `${copy} / ${other}`).eq(synergies.get(original, other));
      }
    }
  });

  it('Copies of the same original have synergy 9 with each other', () => {
    expect(synergies.get('V. Spacefarer', 'Spacefarer4')).eq(9);
  });

  it('Tunneler and Excavator count the same tokens', () => {
    expect(synergies.get('Tunneler', 'Excavator')).eq(9);
  });
});
