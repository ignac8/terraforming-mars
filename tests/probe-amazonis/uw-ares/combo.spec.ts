import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';

describe('probe ares+underworld combos on Amazonis', () => {
  for (const players of [1, 2, 4]) {
    for (const ma of [RandomMAOptionType.NONE, RandomMAOptionType.LIMITED]) {
      it(`BUG: all-expansion setup does not crash players=${players} ma=${ma}`, () => {
        for (let i = 0; i < 20; i++) {
          const [game] = testGame(players, {
            boardName: BoardName.AMAZONIS_PLANITIA,
            aresExtension: true,
            aresHazards: true,
            aresExtremeVariant: players === 1,
            underworldExpansion: true,
            turmoilExtension: true,
            coloniesExtension: true,
            venusNextExtension: true,
            moonExpansion: true,
            pathfindersExpansion: true,
            preludeExtension: true,
            prelude2Expansion: true,
            ceoExtension: true,
            randomMA: ma,
          });
          expect(game.milestones.length).greaterThan(0);
          expect(game.awards.length).greaterThan(0);
        }
      });
    }
  }
});
