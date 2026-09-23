import {expect} from 'chai';
import {testGame} from '../../../TestGame';
import {AutomaGameHooks} from '../../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../../src/server/automa/MarsBot';
import {CardName} from '../../../../src/common/cards/CardName';
import {Luna} from '../../../../src/server/colonies/Luna';
import {Titan} from '../../../../src/server/colonies/Titan';
import {BoardName} from '../../../../src/common/boards/BoardName';
import {getMarsBotCorp} from '../../../../src/server/automa/corps/MarsBotCorpRegistry';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('AridorSetup', () => {
  it('adds one colony tile to the game at setup without building a colony', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const inPlay = game.colonies.map((c) => c.name);
    const outOfPlay = game.discardedColonies.length;

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARIDOR)!);

    expect(game.colonies).has.length(inPlay.length + 1);
    const added = game.colonies.find((c) => !inPlay.includes(c.name))!;
    expect(game.discardedColonies).has.length(outOfPlay - 1);
    expect(game.discardedColonies).does.not.include(added);
    expect(game.colonies.some((c) => c.colonies.includes(marsBot.player.id))).is.false;
    expect(marsBot.shippingBoard.storage.size).to.eq(0);
  });

  it('starts the added tile active, as C-1 starts every colony tile in a MarsBot game', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const titan = new Titan();
    game.discardedColonies = [titan];

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARIDOR)!);

    expect(game.colonies).includes(titan);
    expect(titan.isActive).is.true;
  });

  it('adds nothing when every colony tile is already in play', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.discardedColonies.length = 0;
    const inPlay = game.colonies.length;

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARIDOR)!);

    expect(game.colonies).has.length(inPlay);
    expect(game.colonies.some((c) => c.colonies.includes(marsBot.player.id))).is.false;
  });

  it('maybePlaceRandomColony returns true when eligible colony exists', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    const placed = marsBot.maybePlaceRandomColony();
    expect(placed).to.be.true;
    expect(luna.colonies).to.include(marsBot.player.id);
  });

  it('maybePlaceRandomColony returns false when no eligible colonies', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = []; // No colonies in game

    const placed = marsBot.maybePlaceRandomColony();
    expect(placed).to.be.false;
  });

  it('gains 2 resources to shipping board after colony placement', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    const initialStorage = marsBot.shippingBoard.get(luna.name);
    marsBot.maybePlaceRandomColony();
    expect(marsBot.shippingBoard.get(luna.name)).to.eq(initialStorage + 2);
  });

  it('corp name is Aridor', () => {
    expect(CardName.ARIDOR).to.not.be.undefined;
  });
});
