import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {BonusCardName} from '../../../src/common/automa/BonusCardName';
import {BoardName} from '../../../src/common/boards/BoardName';
import {MarsBotBonusCard} from '../../../src/server/automa/bonusCards/MarsBotBonusCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

function hasBonusCard(deck: Array<IProjectCard | MarsBotBonusCard>, id: BonusCardName): boolean {
  return deck.some((c) => c.name === id);
}

describe('ActionDeckColonies', () => {
  it('Shipping Lines (B19) injected into action deck from gen 2+', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 2;
    marsBot.actionDeck.buildResearch();

    expect(hasBonusCard(marsBot.actionDeck.cards, BonusCardName.SHIPPING_LINES)).to.be.true;
  });

  it('Shipping Lines NOT added in gen 1', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 1;
    marsBot.actionDeck.buildResearch();

    expect(hasBonusCard(marsBot.actionDeck.cards, BonusCardName.SHIPPING_LINES)).to.be.false;
  });

  it('Extended Shipping Lines (B20) added if hasSecondTradeFleet', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 2;
    marsBot.hasSecondTradeFleet = true;
    marsBot.actionDeck.buildResearch();

    expect(hasBonusCard(marsBot.actionDeck.cards, BonusCardName.SHIPPING_LINES)).to.be.true;
    expect(hasBonusCard(marsBot.actionDeck.cards, BonusCardName.EXTENDED_SHIPPING_LINES)).to.be.true;
  });

  it('Extended Shipping Lines NOT added if hasSecondTradeFleet is false', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 2;
    marsBot.hasSecondTradeFleet = false;
    marsBot.actionDeck.buildResearch();

    expect(hasBonusCard(marsBot.actionDeck.cards, BonusCardName.EXTENDED_SHIPPING_LINES)).to.be.false;
  });

  it('Shipping Lines NOT added without coloniesExtension', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: false, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 2;
    marsBot.actionDeck.buildResearch();

    expect(hasBonusCard(marsBot.actionDeck.cards, BonusCardName.SHIPPING_LINES)).to.be.false;
  });

  it('Shipping Lines injected via buildResearchFromDraft', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);

    game.generation = 2;
    const cards = game.projectDeck.drawN(game, 4);
    marsBot.actionDeck.buildResearchFromDraft(cards, true);

    expect(hasBonusCard(marsBot.actionDeck.cards, BonusCardName.SHIPPING_LINES)).to.be.true;
  });
});
