import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {VSpacefarer} from '@/server/milestones/VSpacefarer';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('VSpacefarer', () => {
  it('MarsBot needs space 5 of the Space track', () => {
    const bot = fakeMarsBot();

    for (const run of [
      {position: 4, expected: false},
      {position: 5, expected: true},
    ]) {
      setTrack(bot, Tag.SPACE, run.position);
      expect(marsBotCanClaimMilestone(new VSpacefarer(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
