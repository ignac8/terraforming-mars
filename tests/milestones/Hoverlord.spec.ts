import {expect} from 'chai';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Hoverlord} from '@/server/milestones/Hoverlord';
import {fakeMarsBot} from '../automa/FakeMarsBot';

describe('Hoverlord', () => {
  it('MarsBot needs 7 floaters on its Venus board', () => {
    for (const run of [
      {floaters: 6, expected: false},
      {floaters: 7, expected: true},
    ]) {
      const bot = fakeMarsBot({floaters: run.floaters});
      expect(marsBotCanClaimMilestone(new Hoverlord(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
