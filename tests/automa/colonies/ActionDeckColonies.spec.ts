import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {BoardName} from '../../../src/common/boards/BoardName';
import {MarsBotBonusCard} from '../../../src/server/automa/MarsBotBonusCard';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

function hasBonusCard(deck: Array<any>, id: BonusCardId): boolean {
  return deck.some((c: MarsBotBonusCard | any) => (c as MarsBotBonusCard).id === id);
}

describe('ActionDeckColonies (C-10, C-11)', () => {
  it('C-10: Shipping Lines (B19) injected into action deck from gen 2+', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    // Simulate gen 2
    game.generation = 2;
    marsBot.buildResearchActionDeck();

    expect(hasBonusCard(marsBot.actionDeck, BonusCardId.B19_SHIPPING_LINES)).to.be.true;
  });

  it('C-10: Shipping Lines NOT added in gen 1', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    // Gen 1 (initial deck, no shipping lines)
    game.generation = 1;
    marsBot.buildResearchActionDeck();

    expect(hasBonusCard(marsBot.actionDeck, BonusCardId.B19_SHIPPING_LINES)).to.be.false;
  });

  it('C-11: Extended Shipping Lines (B20) added if hasSecondTradeFleet', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 2;
    marsBot.hasSecondTradeFleet = true;
    marsBot.buildResearchActionDeck();

    expect(hasBonusCard(marsBot.actionDeck, BonusCardId.B19_SHIPPING_LINES)).to.be.true;
    expect(hasBonusCard(marsBot.actionDeck, BonusCardId.B20_EXTENDED_SHIPPING_LINES)).to.be.true;
  });

  it('C-11: Extended Shipping Lines NOT added if hasSecondTradeFleet is false', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 2;
    marsBot.hasSecondTradeFleet = false;
    marsBot.buildResearchActionDeck();

    expect(hasBonusCard(marsBot.actionDeck, BonusCardId.B20_EXTENDED_SHIPPING_LINES)).to.be.false;
  });

  it('C-10: Shipping Lines NOT added without coloniesExtension', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: false, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 2;
    marsBot.buildResearchActionDeck();

    expect(hasBonusCard(marsBot.actionDeck, BonusCardId.B19_SHIPPING_LINES)).to.be.false;
  });

  it('C-10: Shipping Lines injected via buildResearchActionDeckFromDraft', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 2;
    const cards = game.projectDeck.drawN(game, 4);
    marsBot.buildResearchActionDeckFromDraft(cards, true);

    expect(hasBonusCard(marsBot.actionDeck, BonusCardId.B19_SHIPPING_LINES)).to.be.true;
  });
});
