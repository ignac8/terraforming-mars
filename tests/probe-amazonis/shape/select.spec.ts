import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {DEFAULT_GAME_OPTIONS} from '@/server/game/GameOptions';
import {chooseMilestonesAndAwards, getCandidates} from '@/server/ma/MilestoneAwardSelector';
import {milestoneManifest} from '@/server/milestones/Milestones';
import {awardManifest} from '@/server/awards/Awards';
import {synergies} from '@/server/ma/MilestoneAwardSynergies';
import {testGame} from '@tests/TestGame';
import {ALL_MODULES} from '@/common/cards/GameModule';

describe('probe shape: M&A selection on Amazonis Planitia', () => {
  const base = {...DEFAULT_GAME_OPTIONS, boardName: BoardName.AMAZONIS_PLANITIA};

  for (const randomMA of [RandomMAOptionType.NONE, RandomMAOptionType.LIMITED, RandomMAOptionType.UNLIMITED]) {
    for (const modularMA of [false, true]) {
      for (const includeFanMA of [false, true]) {
        for (const venus of [false, true]) {
          it(`draw randomMA=${randomMA} modular=${modularMA} fan=${includeFanMA} venus=${venus}`, () => {
            for (let i = 0; i < 40; i++) {
              const opts = {...base, randomMA, modularMA, includeFanMA, venusNextExtension: venus};
              const r = chooseMilestonesAndAwards(opts);
              const want = venus ? 6 : 5;
              if (randomMA === RandomMAOptionType.NONE) {
                expect(r.milestones.length).eq(want);
                expect(r.awards.length).eq(want);
              } else {
                expect(r.milestones.length).eq(want);
                expect(r.awards.length).eq(want);
              }
              expect(new Set(r.milestones).size).eq(r.milestones.length);
              expect(new Set(r.awards).size).eq(r.awards.length);
            }
          });
        }
      }
    }
  }

  it('all expansions + random MA game boots', () => {
    for (const randomMA of [RandomMAOptionType.LIMITED, RandomMAOptionType.UNLIMITED, RandomMAOptionType.NONE]) {
      for (let i = 0; i < 10; i++) {
        const [game] = testGame(2, {
          boardName: BoardName.AMAZONIS_PLANITIA, randomMA,
          venusNextExtension: true, coloniesExtension: true, turmoilExtension: true, aresExtension: true,
          moonExpansion: true, pathfindersExpansion: true, underworldExpansion: true, preludeExtension: true, prelude2Expansion: true,
          ceoExtension: true,
        });
        expect(game.milestones.length).eq(6);
        expect(game.awards.length).eq(6);
      }
    }
    void ALL_MODULES;
  });

  it('every Amazonis Planitia M&A exists in the manifests and is constructible', () => {
    for (const n of milestoneManifest.boards[BoardName.AMAZONIS_PLANITIA]) expect(milestoneManifest.create(n), n).is.not.undefined;
    for (const n of awardManifest.boards[BoardName.AMAZONIS_PLANITIA]) expect(awardManifest.create(n), n).is.not.undefined;
  });

  it('BUG?: new Amazonis Planitia M&As have synergy matrix entries', () => {
    const names = [...milestoneManifest.boards[BoardName.AMAZONIS_PLANITIA], ...awardManifest.boards[BoardName.AMAZONIS_PLANITIA]];
    const all = [...Object.keys(milestoneManifest.all), ...Object.keys(awardManifest.all)];
    const missing = names.filter((n) => all.every((o) => o === n || synergies.get(n, o) === 0));
    expect(missing).deep.eq([]);
  });

  it('candidates (fan MA on, non-modular) include Amazonis Planitia MAs only when compatible', () => {
    const [ms, as] = getCandidates({...base, modularMA: false, includeFanMA: true, randomMA: RandomMAOptionType.LIMITED});
    console.log('milestones', ms.join(','));
    console.log('awards', as.join(','));
  });
});
