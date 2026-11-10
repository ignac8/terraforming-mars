import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {CHEUNG_SHING_MARS_MARSBOT_CORP} from '@/server/automa/corps/prelude/CheungShingMARSMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track index on the Tharsis board
const BUILDING = 0;

describe('CheungShingMARSMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('gains 5 M€ for the silver resource cubes on spaces 4 to 18 of the building track', () => {
    const {marsBot, calls} = recordingMarsBot();

    CHEUNG_SHING_MARS_MARSBOT_CORP.effect!.onTrackCubeTrigger!(marsBot, BUILDING, 4, 'credit');

    expect(calls).deep.eq(['gainMc(5)']);
    expect(trackCubes(CHEUNG_SHING_MARS_MARSBOT_CORP)).deep.eq(Array.from({length: 15}, (_, i) => `building credit ${i + 4}`));
  });

  it('has building tag and building draft priority', () => {
    const corp = getMarsBotCorp(CardName.CHEUNG_SHING_MARS)!;
    expect(corp.tags).to.deep.eq([Tag.BUILDING]);
    expect(corp.draftPriority).to.deep.eq({type: 'tags', tags: [Tag.BUILDING]});
  });

  it('has credit cubes on building track positions 4-18', () => {
    const corp = getMarsBotCorp(CardName.CHEUNG_SHING_MARS)!;
    expect(corp.trackCubes!.length).to.eq(15);
    expect(corp.trackCubes![0]).to.deep.include({trackIndex: 0, position: 4, cubeType: 'credit'});
    expect(corp.trackCubes![14]).to.deep.include({trackIndex: 0, position: 18, cubeType: 'credit'});
  });

  it('gains 5 M€, a silver resource cube, when the building track reaches a credit cube', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.CHEUNG_SHING_MARS)!);
    marsBot.marsBotBoard.tracks[0].position = 3;
    const mc = marsBot.turnResolver.megacredits;

    marsBot.advanceTrack(0);

    expect(marsBot.turnResolver.megacredits).to.eq(mc + 5);
  });
});
