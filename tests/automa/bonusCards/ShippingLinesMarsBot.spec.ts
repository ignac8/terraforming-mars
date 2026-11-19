import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotBonusCard, bonusCard, createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {Europa} from '@/server/colonies/Europa';
import {Luna} from '@/server/colonies/Luna';
import {testGame} from '../../TestGame';
import {getMarsBot, createAutomaGame} from '../corps/CorpGame';
import {bonusDeckIds} from './BonusCardGame';

function b19Card(): MarsBotBonusCard {
  return bonusCard(BonusCardId.B19_SHIPPING_LINES, 'Shipping Lines' as CardName);
}

describe('ShippingLinesMarsBot', () => {
  it('C-17: selects best colony and trades', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    luna.trackPosition = 4;
    game.colonies = [luna];
    marsBot.turnResolver.megacredits = 3;
    const card = b19Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot['bonusResolver'].resolve(card);
    // Should have spent 1 MC and gained 2 resources to Luna
    expect(marsBot.turnResolver.megacredits).to.eq(2);
    expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
    expect(luna.visitor).to.eq(marsBot.player.id);
  });

  // Nick: with no M€ to pay, the card does nothing (BGG 3599965); rulebook A p.5: no Failed Action.
  it('C-17: no effect and no Failed Action with 0 M€', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];
    marsBot.turnResolver.megacredits = 0;
    const card = b19Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot['bonusResolver'].resolve(card);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
    expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(0);
    expect(luna.visitor).is.undefined;
  });

  // A bonus card that can't resolve is not a Failed Action (rulebook A, p.5)
  it('C-17: no effect and no Failed Action if no tradeable colony', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = []; // No colonies
    marsBot.turnResolver.megacredits = 3;
    const card = b19Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot['bonusResolver'].resolve(card);
    expect(marsBot.turnResolver.megacredits).to.eq(3);
  });

  it('C-24b: Europa trade raises TR instead of resources', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const europa = new Europa();
    europa.trackPosition = 5;
    game.colonies = [europa];
    marsBot.turnResolver.megacredits = 3;
    const trBefore = marsBot.player.terraformRating;
    const card = b19Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot['bonusResolver'].resolve(card);
    expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
    expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0);
  });

  it('stays out of the bonus deck after it resolves, and so does Extended Shipping Lines', () => {
    const {marsBot} = createAutomaGame({coloniesExtension: true});

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B19_SHIPPING_LINES));
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B20_EXTENDED_SHIPPING_LINES));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B19_SHIPPING_LINES);
    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B20_EXTENDED_SHIPPING_LINES);
  });
});
