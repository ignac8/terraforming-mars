import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {MarsBotCorpResolver} from '../../../src/server/automa/corps/MarsBotCorpResolver';
import {Luna} from '../../../src/server/colonies/Luna';
import {BoardName} from '../../../src/common/boards/BoardName';
import {CardName} from '../../../src/common/cards/CardName';
import {getMarsBotCorp} from '../../../src/server/automa/corps/MarsBotCorpRegistry';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

/** Puts a colony cube at `position` of the track `trackIndex` on `marsBot`. */
function registerColonyCube(marsBot: MarsBot, trackIndex: number, position: number): void {
  const key = `${trackIndex}:${position}`;
  marsBot.trackCubePositions.set(key, {trackIndex, position, cubeType: 'black'});
  marsBot.colonyCubePositions.add(key);
  marsBot.hasColonyCubes = true;
}

describe('ColonyCubeTrigger (C-X3)', () => {
  it('places a colony when colony cube is triggered', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    registerColonyCube(marsBot, 7, 10);

    const mcBefore = marsBot.megacredits;
    MarsBotCorpResolver.onTrackAdvanced(marsBot, 7, 10);

    expect(marsBot.megacredits).to.eq(Math.max(0, mcBefore - 5));
    expect(luna.colonies).to.include(marsBot.player.id);
    expect(marsBot.shippingBoard.get(luna.name)).to.eq(2);
  });

  it("is not one of the corp's cubes, so Point Luna's black cube effect stays off it", () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];
    registerColonyCube(marsBot, 1, 7);
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.POINT_LUNA)!);
    marsBot.marsBotBoard.tracks[1].position = 6;

    marsBot.advanceTrack(1);

    expect(luna.colonies).to.include(marsBot.player.id);
    expect(marsBot.marsBotBoard.tracks[1].position).to.eq(7);
  });

  it('failed action when no eligible colonies for colony cube', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = [];

    registerColonyCube(marsBot, 7, 10);

    const mcBefore = marsBot.megacredits;
    MarsBotCorpResolver.onTrackAdvanced(marsBot, 7, 10);

    // The colony costs 5 M€, then the Failed Action gives some back.
    expect(marsBot.megacredits).to.be.greaterThan(mcBefore - 5);
  });

  it('does not trigger colony placement when cube key does not match the triggered position', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    registerColonyCube(marsBot, 7, 10);
    // Position 5 holds a cube that is not a colony cube.
    marsBot.trackCubePositions.set('7:5', {trackIndex: 7, position: 5, cubeType: 'white'});

    MarsBotCorpResolver.onTrackAdvanced(marsBot, 7, 5);

    expect(luna.colonies).to.not.include(marsBot.player.id);
  });

  it('does nothing (no cube) when triggered at a position with no cube', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    const mcBefore = marsBot.megacredits;
    MarsBotCorpResolver.onTrackAdvanced(marsBot, 7, 10);

    expect(marsBot.megacredits).to.eq(mcBefore);
    expect(luna.colonies).to.not.include(marsBot.player.id);
  });
});
