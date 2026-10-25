import {expect} from 'chai';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Tactician4} from '@/server/milestones/modular/Tactician4';
import {fakeMarsBot} from '../../automa/FakeMarsBot';

describe('Tactician4', () => {
  it('MarsBot needs 30 M€', () => {
    for (const run of [
      {megacredits: 29, expected: false},
      {megacredits: 30, expected: true},
    ]) {
      const bot = fakeMarsBot({megacredits: run.megacredits});
      expect(marsBotCanClaimMilestone(new Tactician4(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
