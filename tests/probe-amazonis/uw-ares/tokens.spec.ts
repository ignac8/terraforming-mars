import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';

describe('probe uw tokens', () => {
  it('BUG: pile is 91 normally and 136 on Amazonis Planitia (commit message)', () => {
    const [g1] = testGame(2, {underworldExpansion: true});
    const [g2] = testGame(2, {underworldExpansion: true, boardName: BoardName.AMAZONIS_PLANITIA});
    expect(g1.underworldData.tokens.length).eq(91);
    expect(g2.underworldData.tokens.length).eq(136);
  });
});
