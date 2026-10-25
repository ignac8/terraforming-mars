import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {marsBotAwardScore} from '@/server/automa/MarsBotMilestoneAwardEval';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {VENUS_MARSBOT_TRACK} from '@/server/automa/boards/VenusMarsBot';
import {Visionary} from '@/server/awards/Visionary';
import {fakeMarsBot, setAllTracks, setTrack} from '../automa/FakeMarsBot';

describe('Visionary', () => {
  it('MarsBot doubles its lowest track, or its second lowest with Venus Next', () => {
    for (const run of [
      {venusNextExtension: false, tracks: THARSIS_MARSBOT_BOARD},
      {venusNextExtension: true, tracks: [...THARSIS_MARSBOT_BOARD, VENUS_MARSBOT_TRACK]},
    ]) {
      const bot = fakeMarsBot({tracks: run.tracks, gameOptions: {venusNextExtension: run.venusNextExtension}});
      setAllTracks(bot, 3);
      setTrack(bot, Tag.BUILDING, 2);
      if (run.venusNextExtension) {
        setTrack(bot, Tag.VENUS, 0);
      }

      expect(marsBotAwardScore(new Visionary(), bot), `venusNextExtension: ${run.venusNextExtension}`).eq(4);
    }
  });
});
