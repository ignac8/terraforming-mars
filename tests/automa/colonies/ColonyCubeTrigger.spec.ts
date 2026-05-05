import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {MarsBotCorpResolver} from '../../../src/server/automa/corps/MarsBotCorpResolver';
import {Luna} from '../../../src/server/colonies/Luna';
import {BoardName} from '../../../src/common/boards/BoardName';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

/** Set up a colony cube at (trackIndex, position) on the MarsBot. */
function registerColonyCube(marsBot: MarsBot, trackIndex: number, position: number): void {
  const key = `${trackIndex}:${position}`;
  marsBot.trackCubePositions.set(key, {trackIndex, position, cubeType: 'black'});
  marsBot.colonyCubePositions.add(key);
  marsBot.hasColonyCubes = true;
}

describe('ColonyCubeTrigger (C-X3)', () => {
  it('places a colony when colony cube is triggered', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    registerColonyCube(marsBot, 7, 10);

    const mcBefore = marsBot.turnResolver.mcSupply;
    MarsBotCorpResolver.onTrackAdvanced(marsBot, 7, 10);

    // Should have deducted 5 MC
    expect(marsBot.turnResolver.mcSupply).to.eq(Math.max(0, mcBefore - 5));
    // Luna should now have marsBot's colony
    expect(luna.colonies).to.include(marsBot.player.id);
    // And shippingBoard should have 2 resources
    expect(marsBot.shippingBoard.get(luna.name)).to.eq(2);
  });

  it('failed action when no eligible colonies for colony cube', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = []; // No eligible colonies

    registerColonyCube(marsBot, 7, 10);

    const mcBefore = marsBot.turnResolver.mcSupply;
    MarsBotCorpResolver.onTrackAdvanced(marsBot, 7, 10);

    // 5 MC deducted, then Failed Action gives some MC back — net should exceed (mcBefore - 5)
    expect(marsBot.turnResolver.mcSupply).to.be.greaterThan(mcBefore - 5);
  });

  it('does not trigger colony placement when cube key does not match the triggered position', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    // Colony cube at position 10, trigger at position 5 — no match
    registerColonyCube(marsBot, 7, 10);
    // Also register position 5 in trackCubePositions but NOT in colonyCubePositions
    marsBot.trackCubePositions.set('7:5', {trackIndex: 7, position: 5, cubeType: 'white'});

    MarsBotCorpResolver.onTrackAdvanced(marsBot, 7, 5);

    // Colony should NOT be placed (cube at 7:5 is not a colony cube)
    expect(luna.colonies).to.not.include(marsBot.player.id);
  });

  it('does nothing (no cube) when triggered at a position with no cube', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    // No cube registered at 7:10
    const mcBefore = marsBot.turnResolver.mcSupply;
    MarsBotCorpResolver.onTrackAdvanced(marsBot, 7, 10);

    // Nothing should happen
    expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore);
    expect(luna.colonies).to.not.include(marsBot.player.id);
  });
});
