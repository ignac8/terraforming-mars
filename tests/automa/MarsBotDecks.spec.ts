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
import {MarsBotCorpResolver} from '../../src/server/automa/corps/MarsBotCorpResolver';
import {ConstRandom} from '../../src/common/utils/Random';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Mine} from '../../src/server/cards/base/Mine';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {GiantIceAsteroid} from '../../src/server/cards/base/GiantIceAsteroid';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {IndustrialMicrobes} from '../../src/server/cards/base/IndustrialMicrobes';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';

function createAutomaGame(options: Partial<GameOptions> = {}): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, boardName: BoardName.THARSIS, ...options});
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

/** Puts `cards` on top of the project deck, the first one on top. */
function stackProjectDeck(game: IGame, cards: Array<IProjectCard>) {
  game.projectDeck.drawPile.push(...[...cards].reverse());
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

  it('keeps Vitor\'s Overachievement out of later generations once it removes itself, across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.VITOR)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.turnResolver.marsBotMeetsMilestone = () => true;

    const destroyed = marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B04_OVERACHIEVEMENT));
    expect(destroyed).is.true;
    expect(game.claimedMilestones).has.length(1);

    corp.beforeActionPhase!(marsBot);
    expect(actionDeckIds(marsBot)).does.not.include(BonusCardId.B04_OVERACHIEVEMENT);

    const restored = Game.deserialize(game.serialize()).automaHooks!.marsBot;
    restored.corp!.beforeActionPhase!(restored);
    expect(actionDeckIds(restored)).does.not.include(BonusCardId.B04_OVERACHIEVEMENT);
    expect(bonusDeckIds(restored)).does.not.include(BonusCardId.B04_OVERACHIEVEMENT);
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

  it('puts Tycho Magnetics\' Interface Hyperlink at the bottom of the bonus deck', () => {
    const {marsBot} = createAutomaGame();
    // A shuffle would put the card on top with this random draw
    (marsBot as any).random = new ConstRandom(0.99);

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.TYCHO_MAGNETICS)!);

    // The top of the bonus deck is the end of the draw pile
    expect(marsBot.bonusDeck.drawPile[0].id).eq(BonusCardId.B30_INTERFACE_HYPERLINK);
  });

  it('puts Phobolog\'s first 2 space cards in the bonus deck and discards the others it reveals', () => {
    const {game, marsBot} = createAutomaGame();
    const mine = new Mine();
    const asteroid = new Asteroid();
    const giantIceAsteroid = new GiantIceAsteroid();
    stackProjectDeck(game, [mine, asteroid, giantIceAsteroid]);
    const bonusCards = marsBot.bonusDeck.drawPile.length;

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PHOBOLOG)!);

    expect(marsBot.bonusDeck.drawPile).has.length(bonusCards + 2);
    expect(marsBot.bonusDeck.drawPile).to.include.members([asteroid, giantIceAsteroid]);
    expect(game.projectDeck.discardPile).to.include(mine);
  });

  it('puts a science card in Pharmacy Union\'s bonus deck', () => {
    const {game, marsBot} = createAutomaGame();
    const searchForLife = new SearchForLife();
    stackProjectDeck(game, [new Mine(), searchForLife]);

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PHARMACY_UNION)!);

    expect(marsBot.bonusDeck.drawPile).to.include(searchForLife);
    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B01_METEOR_SHOWER);
  });

  it('puts a microbe card in Splice\'s bonus deck', () => {
    const {game, marsBot} = createAutomaGame();
    const tardigrades = new Tardigrades();
    stackProjectDeck(game, [new Mine(), tardigrades]);

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SPLICE)!);

    expect(marsBot.bonusDeck.drawPile).to.include(tardigrades);
    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT);
  });

  it('plays a project card drawn from the bonus deck like any other card', () => {
    const {game, marsBot} = createAutomaGame();
    const asteroid = new Asteroid();
    marsBot.bonusDeck.drawPile.push(asteroid);
    const spaceTrack = marsBot.marsBotBoard.tracks[1].position;

    marsBot.maybeDrawAndResolveBonusCard();

    expect(marsBot.marsBotBoard.tracks[1].position).is.greaterThan(spaceTrack);
    expect(game.projectDeck.discardPile).to.include(asteroid);
    expect(marsBot.bonusDeck.discardPile).to.not.include(asteroid);
  });

  it('keeps project cards in the bonus deck across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.bonusDeck.drawPile.push(new Asteroid());
    marsBot.bonusDeck.discardPile.push(new Tardigrades());

    const restored = Game.deserialize(game.serialize()).automaHooks!.marsBot;

    expect(restored.bonusDeck.drawPile.map((c) => c.name)).deep.eq(marsBot.bonusDeck.drawPile.map((c) => c.name));
    expect(restored.bonusDeck.discardPile.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
  });

  it('lets the player add a microbe to the microbe card they play against Splice', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SPLICE)!);
    const botMegacredits = marsBot.megacredits;
    const tardigrades = new Tardigrades();

    human.playCard(tardigrades);
    runAllActions(game);
    const orOptions = cast(human.popWaitingFor(), OrOptions);
    orOptions.options[0].cb();
    runAllActions(game);

    expect(tardigrades.resourceCount).eq(1);
    expect(human.megaCredits).eq(0);
    expect(marsBot.megacredits).eq(botMegacredits + 2);
  });

  it('gives the player 2 M€ for a microbe card that holds no microbes against Splice', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SPLICE)!);

    human.playCard(new IndustrialMicrobes());
    runAllActions(game);

    cast(human.popWaitingFor(), undefined);
    expect(human.megaCredits).eq(2);
  });

  it('marks the corporations that need an expansion', () => {
    const required = (name: CardName) => getMarsBotCorp(name)!.requiredExpansions;

    expect(required(CardName.VALLEY_TRUST)).deep.eq(['prelude']);
    expect(required(CardName.VIRON)).deep.eq(['venus', 'colonies']);
    expect(required(CardName.CELESTIC)).deep.eq(['venus', 'colonies']);
    expect(required(CardName.MORNING_STAR_INC)).deep.eq(['venus']);
    expect(required(CardName.APHRODITE)).deep.eq(['venus']);
    expect(required(CardName.ARIDOR)).deep.eq(['colonies']);
    expect(required(CardName.POSEIDON)).deep.eq(['colonies']);
    expect(required(CardName.STORMCRAFT_INCORPORATED)).deep.eq(['venus', 'colonies']);
    expect(required(CardName.SEPTUM_TRIBUS)).deep.eq(['turmoil']);
    expect(required(CardName.CREDICOR)).is.undefined;
  });

  it('never gives MarsBot a corporation whose expansion is out of play', () => {
    const {game} = createAutomaGame();
    const expansionCorps = [
      CardName.VALLEY_TRUST, CardName.VIRON, CardName.CELESTIC, CardName.MORNING_STAR_INC, CardName.APHRODITE,
      CardName.ARIDOR, CardName.POSEIDON, CardName.STORMCRAFT_INCORPORATED, CardName.SEPTUM_TRIBUS,
    ];

    for (let i = 0; i < 46; i++) {
      const rng = {next: () => 0, nextInt: (n: number) => i % n} as any;
      const corp = MarsBotCorpResolver.selectCorp(CardName.CREDICOR, game.gameOptions, rng);
      expect(expansionCorps).does.not.include(corp.name);
    }
  });
});
