import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Ecologist} from '@/server/milestones/Ecologist';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('Ecologist', () => {
  it('MarsBot needs space 4 of the Bio track, not 4 across its tags', () => {
    const bot = fakeMarsBot();

    for (const run of [
      {position: 3, expected: false},
      {position: 4, expected: true},
    ]) {
      setTrack(bot, Tag.PLANT, run.position);
      expect(marsBotCanClaimMilestone(new Ecologist(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
