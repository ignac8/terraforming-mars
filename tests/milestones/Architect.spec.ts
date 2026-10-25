import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Architect} from '@/server/milestones/Architect';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('Architect', () => {
  it('MarsBot needs space 6 of the City track', () => {
    const bot = fakeMarsBot();

    for (const run of [
      {position: 5, expected: false},
      {position: 6, expected: true},
    ]) {
      setTrack(bot, Tag.CITY, run.position);
      expect(marsBotCanClaimMilestone(new Architect(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
