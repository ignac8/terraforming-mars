import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotAwardScore} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Industrialist} from '@/server/awards/Industrialist';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('Industrialist', () => {
  it('MarsBot scores its Energy track plus 5', () => {
    const bot = fakeMarsBot();
    setTrack(bot, Tag.POWER, 3);

    expect(marsBotAwardScore(new Industrialist(), bot)).eq(8);
  });
});
