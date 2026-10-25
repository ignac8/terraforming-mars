import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotAwardScore} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Promoter} from '@/server/awards/arabiaTerra/Promoter';
import {fakeMarsBot, setTrack} from '../../automa/FakeMarsBot';

describe('Promoter', () => {
  it('MarsBot scores its Event track', () => {
    const bot = fakeMarsBot();
    setTrack(bot, Tag.EVENT, 3);

    expect(marsBotAwardScore(new Promoter(), bot)).eq(3);
  });
});
