import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {SpaceType} from '@/common/boards/SpaceType';
import {Board} from '@/server/boards/Board';

const options = {
  boardName: BoardName.AMAZONIS_PLANITIA,
  promoCardsOption: true,
  venusNextExtension: true,
  pathfindersExpansion: true,
  coloniesExtension: true,
  turmoilExtension: true,
  underworldExpansion: true,
  moonExpansion: true,
  aresExtension: true,
  aresHazards: true,
  preludeExtension: true,
  prelude2Expansion: true,
  ceoExtension: true,
  communityCardsOption: true,
  starWarsExpansion: true,
};

describe('probe misc: Amazonis setup smoke', function() {
  this.timeout(120000);
  for (const n of [1, 2, 3, 4, 5, 6]) {
    it(`setup never throws and places hazards/neutral tiles legally (${n} players)`, () => {
      const failures: Array<string> = [];
      for (let i = 0; i < 40; i++) {
        try {
          const [game] = testGame(n, {...options, shuffleMapOption: i % 2 === 0}, '-' + i);
          const land = game.board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY);
          if (land.length !== 91) failures.push('space count ' + land.length);
          const tiles = land.filter((s) => s.tile !== undefined);
          // neutral cities must not be adjacent to each other
          const cities = tiles.filter((s) => Board.isCitySpace(s));
          for (const c of cities) {
            for (const a of game.board.getAdjacentSpaces(c)) {
              if (Board.isCitySpace(a)) failures.push(`adjacent neutral cities ${c.id} ${a.id}`);
            }
          }
        } catch (e: any) {
          failures.push(String(e?.message ?? e).split('\n')[0]);
        }
      }
      expect(failures).deep.eq([]);
    });
  }
});
