import {expect} from 'chai';
import {Resource} from '@/common/Resource';
import {FAILED_ACTION_MC} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {Game} from '@/server/Game';
import {MarsBot} from '@/server/automa/MarsBot';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {VENUS_MARSBOT_TRACK} from '@/server/automa/boards/VenusMarsBot';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {MANUTECH_MARSBOT_CORP} from '@/server/automa/corps/venusNext/ManutechMarsBot';
import {testGame} from '../../../TestGame';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track index on the Tharsis board
const EVENT = 2;

function createVenusGame(): MarsBot {
  const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
  return game.automaHooks!.marsBot;
}

describe('ManutechMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('advances a track once more after #5 and #12 but not after another space', () => {
    const {marsBot, calls} = recordingMarsBot();

    for (const position of [5, 6, 12]) {
      MANUTECH_MARSBOT_CORP.effect!.afterTrackSpaceResolved!(marsBot, EVENT, position);
    }

    expect(calls).deep.eq([`advanceTrack(${EVENT})`, `advanceTrack(${EVENT})`]);
  });

  it('puts a black cube on #5 and #12 of every track, Venus included', () => {
    expect(trackCubes(MANUTECH_MARSBOT_CORP, [...THARSIS_MARSBOT_BOARD, VENUS_MARSBOT_TRACK])).to.have.members(
      ['building', 'space', 'event', 'science', 'power', 'earth', 'plant', 'venus'].flatMap((tag) => [`${tag} black 5`, `${tag} black 12`]),
    );
  });

  it('has 16 black cubes, 2 on each of the 8 tracks, Venus included', () => {
    const corp = getMarsBotCorp(CardName.MANUTECH)!;
    expect(corp.trackCubes!.length).to.eq(16); // 8 tracks × 2 positions
  });

  for (let t = 0; t < 8; t++) {
    it('has black cubes at #5 and #12 on every track, Venus included: ' + JSON.stringify({trackIndex: t}), () => {
      const corp = getMarsBotCorp(CardName.MANUTECH)!;
      expect(corp.trackCubes).to.deep.include({trackIndex: t, position: 5, cubeType: 'black'});
      expect(corp.trackCubes).to.deep.include({trackIndex: t, position: 12, cubeType: 'black'});
    });
  }

  it('places no cubes on the Venus track without Venus Next', () => {
    const {marsBot} = createAutomaGame();
    expect(marsBot.marsBotBoard.tracks).to.have.length(7);

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);

    expect([...marsBot.trackCubePositions.values()].filter((c) => c.trackIndex === 7)).is.empty;
  });

  it('places its reminder cubes on the Venus track with Venus Next', () => {
    const marsBot = createVenusGame();

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);

    expect(marsBot.hasCubeAt(7, 5)?.cubeType).to.eq('black');
    expect(marsBot.hasCubeAt(7, 12)?.cubeType).to.eq('black');
  });

  it('advances the Venus track one more space when it reaches #5', () => {
    const marsBot = createVenusGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
    marsBot.marsBotBoard.tracks[7].position = 4;

    marsBot.advanceTrack(7);

    expect(marsBot.marsBotBoard.tracks[7].position).to.eq(6);
  });

  // Our reading: the extra advance off the end of the Venus track is a Failed Action
  it('takes a Failed Action for the extra advance when Venus reaches #12, its last space', () => {
    const marsBot = createVenusGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
    marsBot.marsBotBoard.tracks[7].position = 11;
    const mc = marsBot.turnResolver.megacredits;
    const tr = marsBot.player.terraformRating;

    marsBot.advanceTrack(7);

    expect(marsBot.marsBotBoard.tracks[7].position).to.eq(12);
    expect(marsBot.player.terraformRating).to.eq(tr + 5);
    expect(marsBot.turnResolver.megacredits).to.eq(mc + FAILED_ACTION_MC);
  });

  it('a save from before the Venus cubes still loads and advances Venus at #5', () => {
    const marsBot = createVenusGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
    const serialized = marsBot.game.serialize();
    const state = serialized.automaState!;
    state.trackCubePositions = state.trackCubePositions!.filter((c) => c.trackIndex !== 7);

    const restored = Game.deserialize(serialized).automaHooks!.marsBot;
    expect(restored.hasCubeAt(7, 5)).is.undefined;
    restored.marsBotBoard.tracks[7].position = 4;
    restored.advanceTrack(7);

    expect(restored.marsBotBoard.tracks[7].position).to.eq(6);
  });

  it('reaching #5 advances the same track one more space', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
    marsBot.marsBotBoard.tracks[0].position = 4;

    marsBot.advanceTrack(0);

    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(6);
  });

  it('resolves the #5 space before advancing to #6 and resolving that', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
    marsBot.marsBotBoard.tracks[0].position = 4; // Building #5: tr2, #6: temperature
    const resolved: Array<string> = [];
    const resolveTrackAction = marsBot.turnResolver['resolveTrackAction'].bind(marsBot.turnResolver);
    marsBot.turnResolver['resolveTrackAction'] = (action, trackIndex) => {
      resolved.push(action);
      resolveTrackAction(action, trackIndex);
    };

    marsBot.advanceTrack(0);

    // C29: "after resolving the effect, advance it another space, and resolve that one as well"
    expect(resolved).to.deep.eq(['tr2', 'temperature']);
  });

  it('does not advance again when the track re-reaches #5 after a regression', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
    marsBot.marsBotBoard.tracks[0].position = 4;
    marsBot.advanceTrack(0);
    marsBot.regressTrack(Resource.STEEL);
    marsBot.regressTrack(Resource.STEEL);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(4);

    marsBot.advanceTrack(0);

    // Rulebook B p.3: moving back up does not retrigger a corporation trigger
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(5);
  });
});
