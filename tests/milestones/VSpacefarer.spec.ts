import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {VSpacefarer} from '@/server/milestones/VSpacefarer';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';
import {TestPlayer} from '../TestPlayer';

describe('VSpacefarer', () => {
  it('Can claim with 4 space tags', () => {
    const player = TestPlayer.BLUE.newPlayer();
    player.tagsForTest = {space: 3};
    expect(new VSpacefarer().canClaim(player)).is.false;

    player.tagsForTest = {space: 4};
    expect(new VSpacefarer().canClaim(player)).is.true;
  });

  for (const run of [
    {position: 4, expected: false},
    {position: 5, expected: true},
  ] as const) {
    it(`MarsBot needs space 5 of its Space track, ${JSON.stringify(run)}`, () => {
      const bot = fakeMarsBot();
      setTrack(bot, Tag.SPACE, run.position);

      expect(new VSpacefarer().marsBotCanClaim(bot)).eq(run.expected);
    });
  }
});
