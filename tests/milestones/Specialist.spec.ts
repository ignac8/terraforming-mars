import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Specialist} from '@/server/milestones/Specialist';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('Specialist', () => {
  it('MarsBot needs space 10 on any one track', () => {
    const bot = fakeMarsBot();

    for (const run of [
      {position: 9, expected: false},
      {position: 10, expected: true},
    ]) {
      setTrack(bot, Tag.SCIENCE, run.position);
      expect(marsBotCanClaimMilestone(new Specialist(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
