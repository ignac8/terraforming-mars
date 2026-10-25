import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotAwardScore} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Botanist} from '@/server/awards/arabiaTerra/Botanist';
import {fakeMarsBot, setTrack} from '../../automa/FakeMarsBot';

describe('Botanist', () => {
  it('MarsBot scores its Bio track minus 2, but not less than 0', () => {
    const bot = fakeMarsBot();

    for (const run of [
      {position: 6, expected: 4},
      {position: 1, expected: 0},
    ]) {
      setTrack(bot, Tag.PLANT, run.position);
      expect(marsBotAwardScore(new Botanist(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
