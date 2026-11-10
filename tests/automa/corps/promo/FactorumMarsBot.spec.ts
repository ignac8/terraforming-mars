import {expect} from 'chai';
import {Resource} from '@/common/Resource';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {FACTORUM_MARSBOT_CORP} from '@/server/automa/corps/promo/FactorumMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track indexes on the Tharsis board
const BUILDING = 0;
const SPACE = 1;

describe('FactorumMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('stores 1 M€ for each advance of the building track and none for another track', () => {
    const {marsBot, corpState} = recordingMarsBot();
    const onCube = FACTORUM_MARSBOT_CORP.effect!.onTrackCubeTrigger!;

    onCube(marsBot, BUILDING, 1, 'white');
    onCube(marsBot, BUILDING, 2, 'white');
    onCube(marsBot, SPACE, 1, 'white');

    expect(corpState.get('mcOnCard')).eq(2);
  });

  it('has a white cube on every space of the building track, and Supply and Demand as its action deck bonus card', () => {
    expect(trackCubes(FACTORUM_MARSBOT_CORP)).deep.eq(Array.from({length: 18}, (_, i) => `building white ${i + 1}`));
    expect(FACTORUM_MARSBOT_CORP.trackCubesTriggerEveryAdvance).is.true;
    expect(FACTORUM_MARSBOT_CORP.actionDeckBonusCard).eq(BonusCardId.B24_SUPPLY_AND_DEMAND);
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
