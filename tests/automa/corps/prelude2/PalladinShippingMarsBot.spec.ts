import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {PALLADIN_SHIPPING_MARSBOT_CORP} from '@/server/automa/corps/prelude2/PalladinShippingMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track indexes on the Tharsis board
const SPACE = 1;
const EVENT = 2;

describe('PalladinShippingMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('gains 5 M€ at setup', () => {
    const {marsBot, calls} = recordingMarsBot();

    PALLADIN_SHIPPING_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['gainMc(5)']);
  });

  // A white and a black cube on the card pay for one temperature step
  it('raises the temperature once a white and a black cube are on the card', () => {
    const {marsBot, calls, corpState} = recordingMarsBot();
    const onCube = PALLADIN_SHIPPING_MARSBOT_CORP.effect!.onTrackCubeTrigger!;

    onCube(marsBot, SPACE, 3, 'white');
    onCube(marsBot, SPACE, 4, 'white');
    onCube(marsBot, EVENT, 3, 'black');

    expect(calls).deep.eq(['raiseTemperature(1)']);
    expect(corpState.get('whiteCubesOnCard')).eq(1);
    expect(corpState.get('blackCubesOnCard')).eq(0);
  });

  it('puts white cubes on the space track and black cubes on the same spaces of the event track', () => {
    expect(trackCubes(PALLADIN_SHIPPING_MARSBOT_CORP)).to.have.members([
      ...[3, 4, 6, 8, 10, 11].map((position) => `space white ${position}`),
      ...[3, 4, 6, 8, 10, 11].map((position) => `event black ${position}`),
    ]);
  });

  it('collects cubes and pairs them for temperature raise', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.PALLADIN_SHIPPING)!;
    marsBot.setCorpAndSetup(corp);

    // Collect 1 white cube
    corp.effect!.onTrackCubeTrigger!(marsBot, 1, 3, 'white');
    expect(marsBot.corpSpecificState.get('whiteCubesOnCard')).to.eq(1);

    // Collect 1 black cube: should pair and raise temp
    corp.effect!.onTrackCubeTrigger!(marsBot, 2, 3, 'black');
    expect(marsBot.corpSpecificState.get('whiteCubesOnCard')).to.eq(0);
    expect(marsBot.corpSpecificState.get('blackCubesOnCard')).to.eq(0);
  });
});
