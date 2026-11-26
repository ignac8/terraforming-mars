import {expect} from 'chai';
import {ShippingLines} from '@/server/automa/bonusCards/ShippingLines';
import {recordingMarsBot} from '../corps/RecordingMarsBot';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {BoardName} from '@/common/boards/BoardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCard';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {Europa} from '@/server/colonies/Europa';
import {Luna} from '@/server/colonies/Luna';
import {testGame} from '../../TestGame';
import {getMarsBot, createAutomaGame} from '../corps/CorpGame';
import {bonusCardsInBonusDeck} from './BonusCardGame';


function b19Card(): MarsBotBonusCard {
  return createBonusCard(BonusCardName.SHIPPING_LINES);
}

describe('ShippingLines', () => {
  it('trades with a colony', () => {
    const traded: Array<BonusCardName> = [];
    const {marsBot} = recordingMarsBot({maybeTrade: (bonusCardName) => traded.push(bonusCardName)});

    expect(new ShippingLines().resolve(marsBot)).is.false;
    expect(traded).deep.eq([BonusCardName.SHIPPING_LINES]);
  });

  it('selects best colony and trades', () => {
    const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    luna.trackPosition = 4;
    game.colonies = [luna];
    marsBot.megacredits = 3;
    const card = b19Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot.actionDeck.playBonusCard(card);
    // Should have spent 1 MC and gained 2 resources to Luna
    expect(marsBot.megacredits).to.eq(2);
    expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
    expect(luna.visitor).to.eq(marsBot.player.id);
  });

  // Nick: with no M€ to pay, the card does nothing (BGG 3599965); rulebook A p.5: no Failed Action.
  it('no effect and no Failed Action with 0 M€', () => {
    const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];
    marsBot.megacredits = 0;
    const card = b19Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot.actionDeck.playBonusCard(card);
    expect(marsBot.megacredits).to.eq(0);
    expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(0);
    expect(luna.visitor).is.undefined;
  });

  // A bonus card that can't resolve is not a Failed Action (rulebook A, p.5)
  it('no effect and no Failed Action if no tradeable colony', () => {
    const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = [];
    marsBot.megacredits = 3;
    const card = b19Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot.actionDeck.playBonusCard(card);
    expect(marsBot.megacredits).to.eq(3);
  });

  it('Europa trade raises TR instead of resources', () => {
    const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const europa = new Europa();
    europa.trackPosition = 5;
    game.colonies = [europa];
    marsBot.megacredits = 3;
    const trBefore = marsBot.player.terraformRating;
    const card = b19Card();
    marsBot.bonusDeck.drawPile.push(card);
    marsBot.actionDeck.playBonusCard(card);
    expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
    expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0);
  });

  it('stays out of the bonus deck after it resolves, and so does Extended Shipping Lines', () => {
    const {marsBot} = createAutomaGame({expansions: {colonies: true}});

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SHIPPING_LINES));
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.EXTENDED_SHIPPING_LINES));

    expect(bonusCardsInBonusDeck(marsBot)).does.not.include(BonusCardName.SHIPPING_LINES);
    expect(bonusCardsInBonusDeck(marsBot)).does.not.include(BonusCardName.EXTENDED_SHIPPING_LINES);
  });
});
