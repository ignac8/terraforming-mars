import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {trackCubeKey} from '../../../src/server/automa/MarsBotCorpTypes';
import {Tag} from '../../../src/common/cards/Tag';
import {BoardName} from '../../../src/common/boards/BoardName';
import {CardName} from '../../../src/common/cards/CardName';
import {getMarsBotCorp} from '../../../src/server/automa/corps/MarsBotCorpRegistry';

function getMarsBotFromGame(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('MarsBot Colonies — 2nd Trade Fleet Cube (C-6, C-27)', () => {
  it('places white cube at Energy track position 9 when coloniesExtension enabled (C-6)', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);

    const energyTrackIdx = marsBot.marsBotBoard.tagToTrack[Tag.POWER];
    expect(energyTrackIdx).to.not.be.undefined;
    const key = trackCubeKey(energyTrackIdx!, 9);
    const cube = marsBot.trackCubePositions.get(key);
    expect(cube).to.not.be.undefined;
    expect(cube!.cubeType).to.eq('white');
    expect(cube!.position).to.eq(9);
  });

  it('does NOT place trade fleet cube when coloniesExtension is disabled', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: false, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    const energyTrackIdx = marsBot.marsBotBoard.tagToTrack[Tag.POWER];
    expect(energyTrackIdx).to.not.be.undefined;
    const key = trackCubeKey(energyTrackIdx!, 9);
    expect(marsBot.trackCubePositions.has(key)).to.be.false;
  });

  it('tradeFleetCubeKey is set when coloniesExtension enabled (C-6)', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    expect(marsBot.tradeFleetCubeKey).to.eq('4:9');
  });

  it('follows the Energy track on Vastitas Borealis, where it also carries the City tag', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.VASTITAS_BOREALIS_NOVA});
    const marsBot = getMarsBotFromGame(game);
    const energyTrackIdx = marsBot.marsBotBoard.tagToTrack[Tag.POWER]!;
    expect(marsBot.marsBotBoard.tagToTrack[Tag.CITY]).to.eq(energyTrackIdx);
    expect(marsBot.tradeFleetCubeKey).to.eq(trackCubeKey(energyTrackIdx, 9));
  });

  it('hasSecondTradeFleet starts false', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    expect(marsBot.hasSecondTradeFleet).to.be.false;
  });

  it('unlocks 2nd trade fleet when Energy track reaches position 9 (C-27)', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    const energyTrackIdx = marsBot.marsBotBoard.tagToTrack[Tag.POWER]!;
    while (marsBot.marsBotBoard.tracks[energyTrackIdx].position < 9) {
      marsBot.turnResolver.advanceTrack(energyTrackIdx);
    }
    expect(marsBot.hasSecondTradeFleet).to.be.true;
  });

  it('does not unlock 2nd trade fleet on Event track position 9', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    const eventTrackIdx = marsBot.marsBotBoard.tagToTrack[Tag.EVENT]!;
    while (marsBot.marsBotBoard.tracks[eventTrackIdx].position < 9) {
      marsBot.turnResolver.advanceTrack(eventTrackIdx);
    }
    expect(marsBot.hasSecondTradeFleet).to.be.false;
  });

  it('still resolves the printed space: Energy 9 raises the temperature', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    marsBot.marsBotBoard.tracks[4].position = 8;
    const temperature = game.getTemperature();

    marsBot.advanceTrack(4);

    expect(marsBot.hasSecondTradeFleet).to.be.true;
    expect(game.getTemperature()).to.eq(temperature + 2);
  });

  it('shares Energy 9 with Helion\'s white cube: the card replaces the temperature and the fleet unlocks', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.HELION)!);
    marsBot.marsBotBoard.tracks[4].position = 8;
    const temperature = game.getTemperature();
    const deckSize = game.projectDeck.drawPile.length;

    marsBot.advanceTrack(4);

    expect(marsBot.hasSecondTradeFleet).to.be.true;
    expect(game.getTemperature()).to.eq(temperature);
    expect(game.projectDeck.drawPile.length).to.be.lessThan(deckSize);
  });

  it('keeps the Event track cube in games saved before the cube moved', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    const state = marsBot.serialize();
    state.trackCubePositions = [{trackIndex: 2, position: 9, cubeType: 'white'}];

    marsBot.restoreState(state);

    expect(marsBot.tradeFleetCubeKey).to.eq('2:9');
    marsBot.marsBotBoard.tracks[2].position = 8;
    marsBot.advanceTrack(2);
    expect(marsBot.hasSecondTradeFleet).to.be.true;
  });

  it('does NOT unlock 2nd trade fleet without coloniesExtension', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: false, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    const energyTrackIdx = marsBot.marsBotBoard.tagToTrack[Tag.POWER]!;
    while (marsBot.marsBotBoard.tracks[energyTrackIdx].position < 9) {
      marsBot.turnResolver.advanceTrack(energyTrackIdx);
    }
    expect(marsBot.hasSecondTradeFleet).to.be.false;
  });

  it('serializes and restores hasSecondTradeFleet', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    marsBot.hasSecondTradeFleet = true;

    const state = marsBot.serialize();
    expect(state.hasSecondTradeFleet).to.be.true;

    marsBot.hasSecondTradeFleet = false; // Reset
    marsBot.restoreState(state);
    expect(marsBot.hasSecondTradeFleet).to.be.true;
  });

  it('does not serialize hasSecondTradeFleet when false', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    const state = marsBot.serialize();
    expect(state.hasSecondTradeFleet).to.be.undefined;
  });

  it('serializes trade fleet cube in trackCubePositions even without a corp', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    const state = marsBot.serialize();
    expect(state.trackCubePositions).to.not.be.undefined;
    expect(state.trackCubePositions!.some((c) => c.position === 9 && c.cubeType === 'white')).to.be.true;
  });
});
