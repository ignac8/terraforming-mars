import {expect} from 'chai';
import {Resource} from '../../src/common/Resource';
import {trackCubeKey, MarsBotTrackCube} from '../../src/server/automa/MarsBotCorpTypes';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {SeededRandom} from '../../src/common/utils/Random';
import {testGame} from '../TestGame';

function createMarsBot(): MarsBot {
  const [game, player] = testGame(1);
  return new MarsBot(game, player, player, THARSIS_MARSBOT_BOARD, 'normal', new SeededRandom(42));
}

describe('MarsBot track regression', () => {
  it('regressTrack maps Steel to Building track (index 0)', () => {
    const mb = createMarsBot();
    mb.tracks.all[0].advance();
    mb.tracks.all[0].advance();

    mb.regressTrack(Resource.STEEL);
    expect(mb.tracks.all[0].position).to.eq(1);
  });

  it('regressTrack maps Energy to Energy track (index 4)', () => {
    const mb = createMarsBot();
    for (let i = 0; i < 3; i++) {
      mb.tracks.all[4].advance();
    }

    mb.regressTrack(Resource.ENERGY);
    expect(mb.tracks.all[4].position).to.eq(2);
  });

  it('regressTrack ignores resources not mapped to any track', () => {
    const mb = createMarsBot();
    mb.tracks.all[1].advance();

    mb.regressTrack(Resource.TITANIUM);
    expect(mb.tracks.all[1].position).to.eq(0);
  });
});

describe('MarsBot serialization roundtrip', () => {
  it('preserves track positions', () => {
    const mb = createMarsBot();
    mb.tracks.all[0].advance();
    mb.tracks.all[0].advance();
    mb.tracks.all[3].advance();

    const state = mb.serialize();
    const mb2 = createMarsBot();
    mb2.restoreState(state);

    expect(mb2.tracks.all[0].position).to.eq(2);
    expect(mb2.tracks.all[3].position).to.eq(1);
    expect(mb2.tracks.all[1].position).to.eq(0);
  });

  it('preserves cube positions', () => {
    const mb = createMarsBot();
    const cube: MarsBotTrackCube = {trackIndex: 1, position: 5, cubeType: 'black'};
    mb.trackCubePositions.set(trackCubeKey(1, 5), cube);
    mb.corp = {id: 'C01', name: 'TestCorp', description: '', tags: []} as any;

    const state = mb.serialize();
    const mb2 = createMarsBot();
    mb2.corp = mb.corp;
    mb2.restoreState(state);

    const restored = mb2.hasCubeAt(1, 5);
    expect(restored).to.not.be.undefined;
    expect(restored!.cubeType).to.eq('black');
  });

  it('preserves megacredits', () => {
    const mb = createMarsBot();
    mb.turnResolver.megacredits = 42;

    const state = mb.serialize();
    const mb2 = createMarsBot();
    mb2.restoreState(state);

    expect(mb2.turnResolver.megacredits).to.eq(42);
  });
});
