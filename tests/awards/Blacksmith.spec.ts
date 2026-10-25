import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotAwardScore} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Blacksmith} from '@/server/awards/Blacksmith';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('Blacksmith', () => {
  it('MarsBot scores the higher of its Building and Space tracks', () => {
    const bot = fakeMarsBot();

    for (const run of [
      {building: 4, space: 2, expected: 4},
      {building: 2, space: 4, expected: 4},
    ]) {
      setTrack(bot, Tag.BUILDING, run.building);
      setTrack(bot, Tag.SPACE, run.space);
      expect(marsBotAwardScore(new Blacksmith(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
