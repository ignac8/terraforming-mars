import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotBonusCard, bonusCard} from '@/server/automa/MarsBotBonusCard';
import {Luna} from '@/server/colonies/Luna';
import {testGame} from '../../TestGame';
import {getMarsBot} from '../corps/CorpGame';

function b20Card(): MarsBotBonusCard {
  return bonusCard(BonusCardId.B20_EXTENDED_SHIPPING_LINES, 'Extended Shipping Lines' as CardName);
}

describe('ExtendedShippingLinesMarsBot', () => {
  it('C-17: same trade logic as B19', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    luna.trackPosition = 3;
    game.colonies = [luna];
    marsBot.turnResolver.megacredits = 3;
    const card = b20Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot['bonusResolver'].resolve(card);
    expect(marsBot.turnResolver.megacredits).to.eq(2);
    expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
  });

  it('C-17: no effect and no Failed Action if all colonies visited', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    luna.visitor = 'psome-player'; // Already traded
    game.colonies = [luna];
    marsBot.turnResolver.megacredits = 3;
    const card = b20Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot['bonusResolver'].resolve(card);
    expect(marsBot.turnResolver.megacredits).to.eq(3);
    expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(0);
  });
});
