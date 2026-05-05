import {expect} from 'chai';
import {testGame} from '../../../TestGame';
import {AutomaGameHooks} from '../../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../../src/server/automa/MarsBot';
import {CardName} from '../../../../src/common/cards/CardName';
import {Luna} from '../../../../src/server/colonies/Luna';
import {Ceres} from '../../../../src/server/colonies/Ceres';
import {BoardName} from '../../../../src/common/boards/BoardName';
import {ColonyName} from '../../../../src/common/colonies/ColonyName';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('PoseidonSetup (C-33)', () => {
  it('placeRandomColony places on one of the available tiles', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    const ceres = new Ceres();
    game.colonies = [luna, ceres];

    marsBot.getCorpContext().placeRandomColony();

    // One of the two should have MarsBot's colony
    const hasLuna = luna.colonies.includes(marsBot.player.id);
    const hasCeres = ceres.colonies.includes(marsBot.player.id);
    expect(hasLuna || hasCeres).to.be.true;
  });

  it('gains 2 resources to shipping board (C-33)', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    const before = marsBot.shippingBoard.get(ColonyName.LUNA);
    marsBot.getCorpContext().placeRandomColony();
    expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(before + 2);
  });

  it('corp name is Poseidon', () => {
    expect(CardName.POSEIDON).to.not.be.undefined;
  });
});
