import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {THORGATE_MARSBOT_CORP} from '@/server/automa/corps/base/ThorgateMarsBot';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {PowerPlant} from '@/server/cards/base/PowerPlant';
import {SolarWindPower} from '@/server/cards/base/SolarWindPower';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track index on the Tharsis board
const POWER = 4;

describe('ThorgateMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // The Setup box (rulebook B p.1)
  it('gains 10 M€ at setup', () => {
    const {marsBot, calls} = recordingMarsBot();

    THORGATE_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['gainMc(10)']);
  });

  it('resolves the first tag of a project card and raises the temperature for the white cubes on spaces 4, 6, 8 and 10 of the power track', () => {
    const {marsBot, calls} = recordingMarsBot();

    THORGATE_MARSBOT_CORP.effect!.onTrackCubeTrigger!(marsBot, POWER, 1, 'white');

    expect(calls).deep.eq(['maybeDrawAndResolveProjectCardFirstTagOnly()', 'raiseTemperature(1)']);
    expect(trackCubes(THORGATE_MARSBOT_CORP)).deep.eq([4, 6, 8, 10].map((position) => `power white ${position}`));
  });

  it('has 4 white cubes on energy track', () => {
    const corp = getMarsBotCorp(CardName.THORGATE)!;
    expect(corp.trackCubes).to.have.length(4);
    expect(corp.trackCubes![0]).to.deep.eq({trackIndex: 4, position: 4, cubeType: 'white'});
    expect(corp.trackCubes![3]).to.deep.eq({trackIndex: 4, position: 10, cubeType: 'white'});
  });

  it('gains 10 M€ on setup', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.THORGATE)!;

    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 10);
  });

  it('has energy draft priority', () => {
    const corp = getMarsBotCorp(CardName.THORGATE)!;
    expect(corp.draftPriority).to.deep.eq({type: 'tags', tags: [Tag.POWER]});
  });

  it('starting energy tag advances energy track', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.THORGATE)!;
    marsBot.setCorpAndSetup(corp);
    // Energy = track 5 (Power/Jovian tag)
    expect(marsBot.marsBotBoard.tracks[4].position).to.be.gte(1);
  });

  it('resolves only the first tag of the card it draws', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.THORGATE)!);
    // Science, Space, Power: "ignoring all except its first tag" leaves Science
    game.projectDeck.drawPile.push(new SolarWindPower());
    marsBot.marsBotBoard.tracks[3].position = 1; // Science 2 has no icon
    const expected = marsBot.marsBotBoard.tracks.map((t) => t.position);
    expected[3] = 2;

    marsBot.maybeDrawAndResolveProjectCardFirstTagOnly();

    expect(marsBot.marsBotBoard.tracks.map((t) => t.position)).to.deep.eq(expected);
  });

  it('resolves the first printed tag of an event, not its Event tag', () => {
    const {game, marsBot} = createAutomaGame();
    game.projectDeck.drawPile.push(new Asteroid());
    marsBot.marsBotBoard.tracks[1].position = 1; // Space 2 has no icon
    const expected = marsBot.marsBotBoard.tracks.map((t) => t.position);
    expected[1] = 2;

    marsBot.maybeDrawAndResolveProjectCardFirstTagOnly();

    expect(marsBot.marsBotBoard.tracks.map((t) => t.position)).to.deep.eq(expected);
  });

  it('logs the space it reached when the drawn card moves the same track on', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.THORGATE)!);
    // Power Plant's first tag is Power, which moves the energy track past the cube. Its Building tag is ignored.
    game.projectDeck.drawPile.push(new PowerPlant());
    marsBot.marsBotBoard.tracks[4].position = 5; // Energy 6: an icon under a white cube
    const logsBefore = game.gameLog.length;

    marsBot.advanceTrack(4);

    const positions = game.gameLog.slice(logsBefore)
      .filter((log) => log.message.startsWith('MarsBot: ${0} track to ${1}') && log.data[0].value === 'power')
      .map((log) => log.data[1].value);
    // The card's step to 7 resolves inside the cube, then the step to 6 and the advance icon there.
    expect(positions).to.deep.eq(['7', '6', '8']);
  });
});
