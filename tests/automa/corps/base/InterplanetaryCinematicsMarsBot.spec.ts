import {expect} from 'chai';
import {Resource} from '@/common/Resource';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {INTERPLANETARY_CINEMATICS_MARSBOT_CORP} from '@/server/automa/corps/base/InterplanetaryCinematicsMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track indexes on the Tharsis board
const BUILDING = 0;
const EVENT = 2;

describe('InterplanetaryCinematicsMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [{track: BUILDING, tag: 'building'}, {track: EVENT, tag: 'event'}]) {
    it(`gains 2 M€ for each advance of the building and event tracks, ${run.tag} cube`, () => {
      const {marsBot, calls} = recordingMarsBot();

      INTERPLANETARY_CINEMATICS_MARSBOT_CORP.effect!.onTrackCubeTrigger!(marsBot, run.track, 1, 'white');

      expect(calls).deep.eq(['gainMc(2)']);
    });
  }

  it('puts a white cube on every space of the building and event tracks', () => {
    const all = Array.from({length: 18}, (_, i) => i + 1);

    expect(trackCubes(INTERPLANETARY_CINEMATICS_MARSBOT_CORP))
      .to.have.members(['building', 'event'].flatMap((tag) => all.map((position) => `${tag} white ${position}`)));
    expect(INTERPLANETARY_CINEMATICS_MARSBOT_CORP.trackCubesTriggerEveryAdvance).is.true;
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
});
