import {expect} from 'chai';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Briber} from '@/server/milestones/Briber';
import {fakeMarsBot} from '../automa/FakeMarsBot';

describe('Briber', () => {
  it('MarsBot needs 20 M€', () => {
    for (const run of [
      {megacredits: 19, expected: false},
      {megacredits: 20, expected: true},
    ]) {
      const bot = fakeMarsBot({megacredits: run.megacredits});
      expect(marsBotCanClaimMilestone(new Briber(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
