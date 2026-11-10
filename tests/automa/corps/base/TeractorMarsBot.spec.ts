import {expect} from 'chai';
import {Resource} from '@/common/Resource';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {TERACTOR_MARSBOT_CORP} from '@/server/automa/corps/base/TeractorMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track index on the Tharsis board
const EARTH = 5;

describe('TeractorMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // The Setup box (rulebook B p.1)
  it('gains 25 M€ at setup', () => {
    const {marsBot, calls} = recordingMarsBot();

    TERACTOR_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['gainMc(25)']);
  });

  it('gains 2 M€ for each advance of the Earth track, which has a white cube on every space', () => {
    const {marsBot, calls} = recordingMarsBot();

    TERACTOR_MARSBOT_CORP.effect!.onTrackCubeTrigger!(marsBot, EARTH, 1, 'white');

    expect(calls).deep.eq(['gainMc(2)']);
    expect(trackCubes(TERACTOR_MARSBOT_CORP)).deep.eq(Array.from({length: 18}, (_, i) => `earth white ${i + 1}`));
    expect(TERACTOR_MARSBOT_CORP.trackCubesTriggerEveryAdvance).is.true;
  });

  it('gains 25 M€ on setup', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.TERACTOR)!;

    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 25);
  });

  it('has earth draft priority', () => {
    const corp = getMarsBotCorp(CardName.TERACTOR)!;
    expect(corp.draftPriority).to.deep.eq({type: 'tags', tags: [Tag.EARTH]});
  });

  it('pays again when the Earth track re-advances after a regression, without the icon', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.TERACTOR)!);
    marsBot.marsBotBoard.tracks[5].position = 3;
    marsBot.advanceTrack(5); // Earth 4: 3 TR
    marsBot.regressTrack(Resource.HEAT);
    const mc = marsBot.turnResolver.megacredits;
    const tr = marsBot.player.terraformRating;

    marsBot.advanceTrack(5);

    expect(marsBot.turnResolver.megacredits).to.eq(mc + 2);
    expect(marsBot.player.terraformRating).to.eq(tr);
  });

  it('replaces the transparent cubes with 18 white cubes on track 6', () => {
    const corp = getMarsBotCorp(CardName.TERACTOR)!;
    expect(corp.trackCubes!.length).to.eq(18);
    expect(corp.trackCubes!.every((c: any) => c.trackIndex === 5 && c.cubeType === 'white')).to.be.true;
  });

  it('gains 2 M€ per Earth track advance', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.TERACTOR)!;
    marsBot.setCorpAndSetup(corp);
    const mcBefore = marsBot.turnResolver.megacredits;
    // Trigger white cube on Earth track (track 6)
    corp.effect!.onTrackCubeTrigger!(marsBot, 5, 1, 'white');
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 2);
  });
});
