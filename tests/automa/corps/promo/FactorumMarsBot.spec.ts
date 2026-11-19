import {expect} from 'chai';
import {Resource} from '@/common/Resource';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {FactorumMarsBot} from '@/server/automa/corps/promo/FactorumMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {TRACK, recordingMarsBot, trackCubes} from '../RecordingMarsBot';

describe('FactorumMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('stores 1 M€ for each advance of the building track and none for another track', () => {
    const {marsBot, corpState} = recordingMarsBot();
    const corp = new FactorumMarsBot();

    corp.onTrackCubeTrigger(marsBot, TRACK.building, 1, 'white');
    corp.onTrackCubeTrigger(marsBot, TRACK.building, 2, 'white');
    corp.onTrackCubeTrigger(marsBot, TRACK.space, 1, 'white');

    expect(corpState.get('mcOnCard')).eq(2);
  });

  it('has a white cube on every space of the building track, and Supply and Demand as its action deck bonus card', () => {
    expect(trackCubes(new FactorumMarsBot())).deep.eq(Array.from({length: 18}, (_, i) => `building white ${i + 1}`));
    expect(new FactorumMarsBot().trackCubesTriggerEveryAdvance).is.true;
    expect(new FactorumMarsBot().actionDeckBonusCard).eq(BonusCardId.B24_SUPPLY_AND_DEMAND);
  });

  it('stores 1 M€ on every advance of the building track, re-advances included', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.FACTORUM)!);
    marsBot.marsBotBoard.tracks[0].position = 3;
    marsBot.advanceTrack(0);
    marsBot.regressTrack(Resource.STEEL);
    const mcOnCard = marsBot.getCorpState('mcOnCard');

    marsBot.advanceTrack(0);

    expect(marsBot.getCorpState('mcOnCard')).to.eq(mcOnCard + 1);
  });
});
