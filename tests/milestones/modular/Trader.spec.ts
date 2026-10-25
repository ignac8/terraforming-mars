import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {VENUS_MARSBOT_TRACK} from '@/server/automa/boards/VenusMarsBot';
import {Trader} from '@/server/milestones/modular/Trader';
import {fakeMarsBot, setTrack} from '../../automa/FakeMarsBot';

describe('Trader', () => {
  it('MarsBot needs space 2 on its Bio, Earth and Venus tracks', () => {
    const bot = fakeMarsBot({tracks: [...THARSIS_MARSBOT_BOARD, VENUS_MARSBOT_TRACK]});
    setTrack(bot, Tag.PLANT, 2);
    setTrack(bot, Tag.EARTH, 2);

    for (const run of [
      {venus: 1, expected: false},
      {venus: 2, expected: true},
    ]) {
      setTrack(bot, Tag.VENUS, run.venus);
      expect(marsBotCanClaimMilestone(new Trader(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
