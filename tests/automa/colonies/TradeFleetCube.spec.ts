import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {trackCubeKey} from '../../../src/server/automa/MarsBotCorpTypes';
import {Tag} from '../../../src/common/cards/Tag';
import {BoardName} from '../../../src/common/boards/BoardName';

function getMarsBotFromGame(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('MarsBot Colonies — 2nd Trade Fleet Cube (C-6, C-27)', () => {
  it('places white cube at Event track position 9 when coloniesExtension enabled (C-6)', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);

    // Event track is index 2 on Tharsis
    const eventTrackIdx = marsBot.board.getTrackIndexForTag(Tag.EVENT);
    expect(eventTrackIdx).to.not.be.undefined;
    const key = trackCubeKey(eventTrackIdx!, 9);
    const cube = marsBot.trackCubePositions.get(key);
    expect(cube).to.not.be.undefined;
    expect(cube!.cubeType).to.eq('white');
    expect(cube!.position).to.eq(9);
  });

  it('does NOT place trade fleet cube when coloniesExtension is disabled', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: false, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    const eventTrackIdx = marsBot.board.getTrackIndexForTag(Tag.EVENT);
    expect(eventTrackIdx).to.not.be.undefined;
    const key = trackCubeKey(eventTrackIdx!, 9);
    expect(marsBot.trackCubePositions.has(key)).to.be.false;
  });

  it('tradeFleetCubeKey is set when coloniesExtension enabled (C-6)', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    expect(marsBot.tradeFleetCubeKey).to.eq('2:9');
  });

  it('hasSecondTradeFleet starts false', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    expect(marsBot.hasSecondTradeFleet).to.be.false;
  });

  it('unlocks 2nd trade fleet when Event track reaches position 9 (C-27)', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    // Advance Event track (index 2) to position 9
    const eventTrackIdx = marsBot.board.getTrackIndexForTag(Tag.EVENT)!;
    while (marsBot.board.tracks[eventTrackIdx].position < 9) {
      marsBot.turnResolver.advanceTrack(eventTrackIdx);
    }
    expect(marsBot.hasSecondTradeFleet).to.be.true;
  });

  it('does NOT unlock 2nd trade fleet without coloniesExtension', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: false, boardName: BoardName.THARSIS});
    const marsBot = getMarsBotFromGame(game);
    const eventTrackIdx = marsBot.board.getTrackIndexForTag(Tag.EVENT)!;
    while (marsBot.board.tracks[eventTrackIdx].position < 9) {
      marsBot.turnResolver.advanceTrack(eventTrackIdx);
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
