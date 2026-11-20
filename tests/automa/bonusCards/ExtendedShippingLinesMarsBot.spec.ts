import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ExtendedShippingLinesMarsBot} from '@/server/automa/bonusCards/ExtendedShippingLinesMarsBot';
import {recordingMarsBot} from '../corps/RecordingMarsBot';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {Luna} from '@/server/colonies/Luna';
import {testGame} from '../../TestGame';
import {getMarsBot} from '../corps/CorpGame';


function b20Card(): MarsBotBonusCard {
  return createBonusCard(BonusCardId.B20_EXTENDED_SHIPPING_LINES);
}

describe('ExtendedShippingLinesMarsBot', () => {
  it('trades with a colony', () => {
    const traded: Array<CardName> = [];
    const {marsBot} = recordingMarsBot({maybeTrade: (cardName) => traded.push(cardName)});

    expect(new ExtendedShippingLinesMarsBot().resolve(marsBot)).is.false;
    expect(traded).deep.eq([CardName.AUTOMA_EXTENDED_SHIPPING_LINES]);
  });

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
