import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {KuiperCooperativeMarsBot} from '@/server/automa/corps/promo/KuiperCooperativeMarsBot';
import {resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

describe('KuiperCooperativeMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {cube: 'white', calls: ['raiseTemperature(1)']},
    {cube: 'black', calls: ['placeOcean()']},
  ] as const) {
    it(`raises the temperature for a white cube and places an ocean for a black one, ${run.cube} cube`, () => {
      const {marsBot, calls} = recordingMarsBot();

      new KuiperCooperativeMarsBot().onTrackCubeTrigger(marsBot, 1, 4, run.cube);

      expect(calls).deep.eq(run.calls);
    });
  }

  it('puts its cubes on the space track', () => {
    expect(trackCubes(new KuiperCooperativeMarsBot())).to.have.members([
      ...[4, 8, 12].map((position) => `space white ${position}`),
      ...[7, 10, 14].map((position) => `space black ${position}`),
    ]);
  });

  it('white cube raises temperature, black cube places ocean', () => {
    const corp = getMarsBotCorp(CardName.KUIPER_COOPERATIVE)!;
    expect(corp.trackCubes!.filter((c) => c.cubeType === 'white').length).to.eq(3);
    expect(corp.trackCubes!.filter((c) => c.cubeType === 'black').length).to.eq(3);
  });
});
