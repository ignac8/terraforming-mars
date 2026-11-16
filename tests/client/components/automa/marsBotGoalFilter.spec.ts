import {expect} from 'chai';
import {marsBotCanPlay} from '@/client/components/automa/marsBotGoalFilter';
import {BoardName} from '@/common/boards/BoardName';

const THARSIS_GAME = {venus: false, turmoil: false, boards: [BoardName.THARSIS]};

describe('marsBotGoalFilter', () => {
  for (const run of [
    {name: 'Mayor', game: THARSIS_GAME, expected: true},
    {name: 'Banker', game: THARSIS_GAME, expected: true},
    {name: 'Networker', game: THARSIS_GAME, expected: false},
    {name: 'Entrepreneur', game: THARSIS_GAME, expected: false},
    {name: 'Venuphile', game: THARSIS_GAME, expected: false},
    {name: 'Venuphile', game: {...THARSIS_GAME, venus: true}, expected: true},
    {name: 'Lobbyist', game: THARSIS_GAME, expected: false},
    {name: 'Lobbyist', game: {...THARSIS_GAME, turmoil: true}, expected: true},
    {name: 'Merchant3', game: THARSIS_GAME, expected: false},
    {name: 'Merchant3', game: {...THARSIS_GAME, boards: [BoardName.AMAZONIS_PLANITIA]}, expected: true},
  ] as const) {
    it('tells whether MarsBot can play it: ' + JSON.stringify(run), () => {
      expect(marsBotCanPlay(run.name, run.game)).eq(run.expected);
    });
  }
});
