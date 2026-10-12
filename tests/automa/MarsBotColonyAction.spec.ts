import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BoardName} from '../../src/common/boards/BoardName';
import {AutomaGameHooks} from '../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {Luna} from '../../src/server/colonies/Luna';
import {ColonyName} from '../../src/common/colonies/ColonyName';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

// Utopia Planitia's Space track has the colony icon on space 5.
const SPACE_TRACK = 1;
const COLONY_SPACE = 5;

describe('MarsBot colony track action (Utopia Planitia)', () => {
  it('sits on space 5 of the Space track', () => {
    const [game] = testGame(1, {automaOption: true, boardName: BoardName.UTOPIA_PLANITIA});
    expect(getMarsBot(game).marsBotBoard.tracks[SPACE_TRACK].definition.layout[COLONY_SPACE]).eq('colony');
  });

  it('builds a colony and gains 2 resources into its storage area', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.UTOPIA_PLANITIA});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];
    marsBot.marsBotBoard.tracks[SPACE_TRACK].position = COLONY_SPACE - 1;

    marsBot.advanceTrack(SPACE_TRACK);

    expect(luna.colonies).deep.eq([marsBot.player.id]);
    expect(marsBot.shippingBoard.get(ColonyName.LUNA)).eq(2);
  });

  it('is a Failed Action when no colony tile can take it', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.UTOPIA_PLANITIA});
    const marsBot = getMarsBot(game);
    game.colonies = [];
    marsBot.marsBotBoard.tracks[SPACE_TRACK].position = COLONY_SPACE - 1;
    const mc = marsBot.turnResolver.megacredits;

    marsBot.advanceTrack(SPACE_TRACK);

    expect(marsBot.turnResolver.megacredits).is.greaterThan(mc);
  });

  it('does nothing without Colonies', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: false, boardName: BoardName.UTOPIA_PLANITIA});
    const marsBot = getMarsBot(game);
    marsBot.marsBotBoard.tracks[SPACE_TRACK].position = COLONY_SPACE - 1;
    const mc = marsBot.turnResolver.megacredits;

    marsBot.advanceTrack(SPACE_TRACK);

    expect(marsBot.marsBotBoard.tracks[SPACE_TRACK].position).eq(COLONY_SPACE);
    expect(marsBot.turnResolver.megacredits).eq(mc);
  });
});
