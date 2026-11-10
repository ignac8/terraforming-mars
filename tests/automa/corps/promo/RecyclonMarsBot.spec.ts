import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {RECYCLON_MARSBOT_CORP} from '@/server/automa/corps/promo/RecyclonMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

describe('RecyclonMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // C23: the cubes on the building track (rulebook B p.3)
  it('advances the plant track for the white cubes on spaces 3, 6, 9, 12, 15 and 18 of the building track', () => {
    const {marsBot, calls} = recordingMarsBot();

    RECYCLON_MARSBOT_CORP.effect!.onTrackCubeTrigger!(marsBot, 0, 3, 'white');

    expect(trackCubes(RECYCLON_MARSBOT_CORP)).deep.eq([3, 6, 9, 12, 15, 18].map((position) => `building white ${position}`));
    expect(calls).deep.eq([`advanceTrack(${marsBot.marsBotBoard.tagToTrack[Tag.PLANT]})`]);
  });

  it('has 6 white cubes on building track', () => {
    const corp = getMarsBotCorp(CardName.RECYCLON)!;
    expect(corp.trackCubes!.length).to.eq(6);
    for (const cube of corp.trackCubes!) {
      expect(cube).to.deep.include({trackIndex: 0, cubeType: 'white'});
    }
  });

  it('white cube on building track advances plant track', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.RECYCLON)!;
    marsBot.setCorpAndSetup(corp);
    const plantBefore = marsBot.marsBotBoard.tracks[6].position;
    corp.effect!.onTrackCubeTrigger!(marsBot, 0, 3, 'white');
    expect(marsBot.marsBotBoard.tracks[6].position).to.be.gte(plantBefore + 1);
  });
});
