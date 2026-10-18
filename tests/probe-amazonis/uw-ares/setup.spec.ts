import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceType} from '@/common/boards/SpaceType';
import {testGame} from '../../TestGame';
import {AresHandler} from '@/server/ares/AresHandler';

describe('probe ares/underworld setup on Amazonis', () => {
  for (const n of [1, 2, 3, 4, 5, 6]) {
    it(`BUG: ares hazards + underworld setup on amazonis planitia, ${n} players`, () => {
      for (let i = 0; i < 150; i++) {
        const [game] = testGame(n, {
          boardName: BoardName.AMAZONIS_PLANITIA,
          aresExtension: true,
          aresHazards: true,
          underworldExpansion: true,
        });
        const hazards = game.board.spaces.filter((s) => AresHandler.hasHazardTile(s));
        const expected = n >= 5 ? 1 : n === 4 ? 2 : 3;
        expect(hazards.length, `players ${n} iter ${i}`).eq(expected);
        for (const h of hazards) {
          expect(h.spaceType).eq(SpaceType.LAND);
          expect(h.undergroundResources).is.undefined;
          expect(h.player).is.undefined;
        }
      }
    });
  }
});
