import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotAwardScore} from '@/server/automa/MarsBotMilestoneAwardEval';
import {AZoologist} from '@/server/awards/amazonisPlanitia/AZoologist';
import {fakeMarsBot, setTrack} from '../../automa/FakeMarsBot';

describe('AZoologist', () => {
  it('MarsBot scores its Bio track plus 5', () => {
    const bot = fakeMarsBot();
    setTrack(bot, Tag.ANIMAL, 3);

    expect(marsBotAwardScore(new AZoologist(), bot)).eq(8);
  });
});
