import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {MarsBotBonusCard, createCorpBonusCard} from '../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {BoardName} from '../../src/common/boards/BoardName';
import {CardName} from '../../src/common/cards/CardName';
import {GameOptions} from '../../src/server/game/GameOptions';
import {getMarsBotCorp} from '../../src/server/automa/corps/MarsBotCorpRegistry';
import {ConstRandom} from '../../src/common/utils/Random';

function createAutomaGame(options: Partial<GameOptions> = {}): {game: IGame, marsBot: MarsBot} {
  const [game] = testGame(1, {automaOption: true, boardName: BoardName.THARSIS, ...options});
  return {game, marsBot: game.automaHooks!.marsBot};
}

function bonusDeckIds(marsBot: MarsBot): Array<string> {
  return [...marsBot.bonusDeck.drawPile, ...marsBot.bonusDeck.discardPile].map((c) => (c as MarsBotBonusCard).id);
}

function actionDeckIds(marsBot: MarsBot): Array<string | undefined> {
  return marsBot.actionDeck.map((c) => (c as MarsBotBonusCard).id);
}

describe('MarsBot decks', () => {
  it('keeps Government Intervention out of the bonus deck after it resolves', () => {
    const {marsBot} = createAutomaGame({venusNextExtension: true});

    marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B16_GOVERNMENT_INTERVENTION);
  });

  it('keeps Party Politics out of the bonus deck after it resolves', () => {
    const {marsBot} = createAutomaGame({turmoilExtension: true});

    marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B21_PARTY_POLITICS));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B21_PARTY_POLITICS);
  });

  it('keeps Shipping Lines out of the bonus deck after they resolve', () => {
    const {marsBot} = createAutomaGame({coloniesExtension: true});

    marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B19_SHIPPING_LINES));
    marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B20_EXTENDED_SHIPPING_LINES));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B19_SHIPPING_LINES);
    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B20_EXTENDED_SHIPPING_LINES);
  });

  it('keeps a corporation\'s generation card out of the bonus deck after it resolves', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ECOLINE)!);

    marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B23_RAPID_SPROUTING));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B23_RAPID_SPROUTING);
  });

  it('keeps Vitor\'s Overachievement out of the bonus deck after it resolves', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.VITOR)!);

    marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B04_OVERACHIEVEMENT));

    expect(marsBot.turnResolver.megacredits).eq(5);
    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B04_OVERACHIEVEMENT);
  });

  it('still discards Overachievement to the bonus deck without Vitor', () => {
    const {marsBot} = createAutomaGame();

    marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B04_OVERACHIEVEMENT));

    expect(marsBot.bonusDeck.discardPile.map((c) => c.id)).includes(BonusCardId.B04_OVERACHIEVEMENT);
  });

  it('puts a corporation\'s generation card in the action deck only once a generation', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.VITOR)!;
    marsBot.setCorpAndSetup(corp);

    corp.beforeActionPhase!(marsBot);
    corp.beforeActionPhase!(marsBot);

    expect(actionDeckIds(marsBot).filter((id) => id === BonusCardId.B04_OVERACHIEVEMENT)).has.length(1);
  });

  it('drops generation cards from the bonus deck of an older save', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    marsBot.bonusDeck.discardPile.push(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    const restored = Game.deserialize(game.serialize()).automaHooks!.marsBot;

    expect(bonusDeckIds(restored)).does.not.include(BonusCardId.B16_GOVERNMENT_INTERVENTION);
  });

  it('shuffles a corporation\'s generation card into the action deck', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ECOLINE)!;
    marsBot.setCorpAndSetup(corp);
    // With the random draw at 0, the card goes on top instead of at the bottom
    (marsBot as any).random = new ConstRandom(0);

    corp.beforeActionPhase!(marsBot);

    expect(marsBot.actionDeck).has.length(5);
    expect(actionDeckIds(marsBot)[0]).eq(BonusCardId.B23_RAPID_SPROUTING);
  });

  it('shuffles Terralabs\' generation card into the action deck', () => {
    const {game, marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.TERRALABS_RESEARCH)!;
    marsBot.setCorpAndSetup(corp);
    (marsBot as any).random = new ConstRandom(0);
    const topCard = game.projectDeck.drawPile[game.projectDeck.drawPile.length - 1];

    corp.beforeActionPhase!(marsBot);

    expect(marsBot.actionDeck).has.length(5);
    expect(marsBot.actionDeck[0]).eq(topCard);
  });

  it('shuffles UNMI\'s Government Subsidy into the bonus deck', () => {
    const {marsBot} = createAutomaGame();
    (marsBot as any).random = new ConstRandom(0);

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.UNITED_NATIONS_MARS_INITIATIVE)!);

    // The top of the bonus deck is the end of the draw pile
    expect(marsBot.bonusDeck.drawPile[0].id).eq(BonusCardId.B31_GOVERNMENT_SUBSIDY);
  });

  it('moves a bonus card into UNMI\'s action deck from generation 2', () => {
    const {game, marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.UNITED_NATIONS_MARS_INITIATIVE)!;
    marsBot.setCorpAndSetup(corp);
    const topBonusCard = marsBot.bonusDeck.drawPile[marsBot.bonusDeck.drawPile.length - 1];
    const bonusCards = marsBot.bonusDeck.drawPile.length;

    corp.beforeActionPhase!(marsBot);
    expect(marsBot.actionDeck).has.length(4);

    game.generation = 2;
    corp.beforeActionPhase!(marsBot);

    expect(marsBot.actionDeck).has.length(5);
    expect(marsBot.actionDeck).includes(topBonusCard);
    expect(marsBot.bonusDeck.drawPile).has.length(bonusCards - 1);
    expect(marsBot.bonusDeck.discardPile).is.empty;
  });
});
