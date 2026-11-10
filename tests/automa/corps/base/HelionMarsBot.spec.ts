import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {MAX_TEMPERATURE} from '@/common/constants';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {HELION_MARSBOT_CORP} from '@/server/automa/corps/base/HelionMarsBot';
import {setTemperature} from '../../../TestingUtils';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track indexes on the Tharsis board
const BUILDING = 0;
const EARTH = 5;

describe('HelionMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {track: BUILDING, cube: 'white', calls: ['maybeDrawAndResolveProjectCard()']},
    {track: EARTH, cube: 'black', calls: ['raiseTemperature(1)']},
  ] as const) {
    it(`draws a project card for a white cube and raises the temperature for a black one, ${run.cube} cube`, () => {
      const {marsBot, calls} = recordingMarsBot();

      HELION_MARSBOT_CORP.effect!.onTrackCubeTrigger!(marsBot, run.track, 1, run.cube);

      expect(calls).deep.eq(run.calls);
    });
  }

  // The card names the tracks by tag, the cube list names them by index
  it('puts its cubes on the tracks the card names', () => {
    expect(trackCubes(HELION_MARSBOT_CORP)).to.have.members([
      'building white 6',
      'space white 9',
      'science white 10',
      'power white 5',
      'power white 9',
      'plant white 11',
      ...[3, 6, 9, 12, 13, 14].map((position) => `earth black ${position}`),
    ]);
  });

  // The card replaces the temperature step only
  it('white cube replaces a temperature step, and no other icon', () => {
    const white = (position: number) => HELION_MARSBOT_CORP.effect!.onTrackCubeTrigger!(recordingMarsBot().marsBot, BUILDING, position, 'white');

    expect(white(6)).is.true;
    expect(white(7)).is.false;
  });

  it('has 6 white + 6 black cubes', () => {
    const corp = getMarsBotCorp(CardName.HELION)!;
    const whiteCubes = corp.trackCubes!.filter((c) => c.cubeType === 'white');
    const blackCubes = corp.trackCubes!.filter((c) => c.cubeType === 'black');
    expect(whiteCubes).to.have.length(6);
    expect(blackCubes).to.have.length(6);
  });

  it('places cubes on setup', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.HELION)!;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.trackCubePositions.size).to.eq(12);
    expect(marsBot.hasCubeAt(0, 6)).to.not.be.undefined;
    expect(marsBot.hasCubeAt(5, 3)).to.not.be.undefined;
  });

  it('reports its cubes to the client on the same track indexes as the tracks', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.HELION)!);

    const model = marsBot.toModel();

    expect(model.tracks[0].tags).to.deep.eq([Tag.BUILDING]);
    expect(model.trackCubes).to.deep.include({trackIndex: 0, position: 6, cubeType: 'white'});
    expect(model.trackCubes).to.deep.include({trackIndex: 5, position: 3, cubeType: 'black'});
    expect(model.trackCubes!.every((cube) => cube.trackIndex >= 0)).to.be.true;
  });

  it('white cube draws a card instead of the temperature step under it', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.HELION)!);
    // No card to draw, so only the temperature icon under the cube could move the temperature.
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    marsBot.marsBotBoard.tracks[0].position = 5; // Building 6: a temperature icon under a white cube
    const temperature = game.getTemperature();

    marsBot.advanceTrack(0);

    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(6);
    expect(game.getTemperature()).to.eq(temperature);
  });

  // Our reading: the cube replaces only a temperature icon, so the city printed under it on the
  // Terra Cimmeria Nova board still resolves
  it('white cube on a non-temperature icon draws a card and resolves the icon too', () => {
    const {game, marsBot} = createAutomaGame({boardName: BoardName.TERRA_CIMMERIA_NOVA});
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.HELION)!);
    let drawn = 0;
    marsBot.maybeDrawAndResolveProjectCard = () => drawn++;
    marsBot.marsBotBoard.tracks[3].position = 9; // Science 10: a city icon under a white cube
    expect(marsBot.marsBotBoard.tracks[3].definition.layout[10]).eq('city');

    marsBot.advanceTrack(3);

    expect(drawn).eq(1);
    expect(game.board.getCities(marsBot.player)).has.length(1);
  });

  it('black cube raises the temperature on top of the space it sits on', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.HELION)!);
    marsBot.marsBotBoard.tracks[5].position = 2; // Earth 3: no icon, a black cube
    const temperature = game.getTemperature();

    marsBot.advanceTrack(5);

    expect(game.getTemperature()).to.eq(temperature + 2);
  });

  // A corp effect is a reaction, not an action, so no Failed Action (Nick)
  it('black cube with the temperature maxed does nothing', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.HELION)!);
    setTemperature(game, MAX_TEMPERATURE);
    marsBot.marsBotBoard.tracks[5].position = 2; // Earth 3: no icon, a black cube
    const mc = marsBot.turnResolver.megacredits;

    marsBot.advanceTrack(5);

    expect(game.getTemperature()).to.eq(MAX_TEMPERATURE);
    expect(marsBot.turnResolver.megacredits).to.eq(mc);
  });
});
