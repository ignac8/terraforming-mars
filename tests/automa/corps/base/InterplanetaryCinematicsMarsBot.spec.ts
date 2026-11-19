import {expect} from 'chai';
import {Resource} from '@/common/Resource';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {InterplanetaryCinematicsMarsBot} from '@/server/automa/corps/base/InterplanetaryCinematicsMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track index on the Tharsis board
const EVENT = 2;

describe('InterplanetaryCinematicsMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [{track: 0, tag: 'building'}, {track: EVENT, tag: 'event'}]) {
    it(`gains 2 M€ for each advance of the building and event tracks, ${run.tag} cube`, () => {
      const {marsBot, calls} = recordingMarsBot();

      new InterplanetaryCinematicsMarsBot().onTrackCubeTrigger(marsBot, run.track, 1, 'white');

      expect(calls).deep.eq(['gainMc(2)']);
    });
  }

  it('puts a white cube on every space of the building and event tracks', () => {
    const all = Array.from({length: 18}, (_, i) => i + 1);

    expect(trackCubes(new InterplanetaryCinematicsMarsBot()))
      .to.have.members(['building', 'event'].flatMap((tag) => all.map((position) => `${tag} white ${position}`)));
    expect(new InterplanetaryCinematicsMarsBot().trackCubesTriggerEveryAdvance).is.true;
  });

  it('has 2 Event starting tags', () => {
    const corp = getMarsBotCorp(CardName.INTERPLANETARY_CINEMATICS)!;
    expect(corp.tags).to.deep.eq([Tag.EVENT, Tag.EVENT]);
  });

  it('pays on every advance of the building and event tracks, re-advances included', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.INTERPLANETARY_CINEMATICS)!);
    marsBot.marsBotBoard.tracks[0].position = 3;
    marsBot.marsBotBoard.tracks[2].position = 10;
    marsBot.advanceTrack(0);
    marsBot.advanceTrack(2);
    marsBot.regressTrack(Resource.STEEL);
    marsBot.regressTrack(Resource.MEGACREDITS);
    const mc = marsBot.turnResolver.megacredits;

    marsBot.advanceTrack(0);
    marsBot.advanceTrack(2);

    expect(marsBot.turnResolver.megacredits).to.eq(mc + 4);
  });

  it('replaces the transparent cubes with 36 white cubes (18 on track 1 + 18 on track 3)', () => {
    const corp = getMarsBotCorp(CardName.INTERPLANETARY_CINEMATICS)!;
    expect(corp.trackCubes!.length).to.eq(36);
    const track1 = corp.trackCubes!.filter((c) => 'trackIndex' in c && c.trackIndex === 0);
    const track3 = corp.trackCubes!.filter((c) => 'trackIndex' in c && c.trackIndex === 2);
    expect(track1.length).to.eq(18);
    expect(track3.length).to.eq(18);
  });

  it('gains 2 M€ per building/event track advance', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.INTERPLANETARY_CINEMATICS)!;
    marsBot.setCorpAndSetup(corp);
    const mcBefore = marsBot.turnResolver.megacredits;
    corp.onTrackCubeTrigger!(marsBot, 0, 1, 'white');
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 2);
    corp.onTrackCubeTrigger!(marsBot, 2, 1, 'white');
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 4);
  });
});
