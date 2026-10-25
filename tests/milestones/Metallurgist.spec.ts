import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Metallurgist} from '@/server/milestones/Metallurgist';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('Metallurgist', () => {
  it('MarsBot needs its Building and Space tracks to add up to 9', () => {
    const bot = fakeMarsBot();
    setTrack(bot, Tag.BUILDING, 4);

    for (const run of [
      {space: 4, expected: false},
      {space: 5, expected: true},
    ]) {
      setTrack(bot, Tag.SPACE, run.space);
      expect(marsBotCanClaimMilestone(new Metallurgist(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
