import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {CForester, Forester} from '@/server/milestones/modular/Forester';
import {fakeMarsBot, setTrack} from '../../automa/FakeMarsBot';

describe('Forester', () => {
  it('MarsBot needs space 6 of the Bio track', () => {
    const bot = fakeMarsBot();

    for (const run of [
      {position: 5, expected: false},
      {position: 6, expected: true},
    ]) {
      setTrack(bot, Tag.PLANT, run.position);
      expect(marsBotCanClaimMilestone(new Forester(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });

  it('C. Forester: MarsBot needs space 10 of the Bio track', () => {
    const bot = fakeMarsBot();

    for (const run of [
      {position: 9, expected: false},
      {position: 10, expected: true},
    ]) {
      setTrack(bot, Tag.PLANT, run.position);
      expect(marsBotCanClaimMilestone(new CForester(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
