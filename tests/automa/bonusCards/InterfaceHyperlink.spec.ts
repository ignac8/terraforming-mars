import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {InterfaceHyperlink} from '@/server/automa/bonusCards/InterfaceHyperlink';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {GiantIceAsteroid} from '@/server/cards/base/GiantIceAsteroid';
import {Mine} from '@/server/cards/base/Mine';
import {PowerPlant} from '@/server/cards/base/PowerPlant';
import {SearchForLife} from '@/server/cards/base/SearchForLife';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {cardsFromJSON} from '@/server/createCard';
import {fakeCard} from '../../TestingUtils';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {TRACK, recordingMarsBot} from '../corps/RecordingMarsBot';

/** A bot with its energy track at `energy` and `topCards` on top of the project deck, the first one on top. */
function hyperlinkBot(energy: number, topCards: ReadonlyArray<IProjectCard>) {
  const played: Array<IProjectCard> = [];
  const {marsBot} = recordingMarsBot({resolveProjectCard: (card) => played.push(card)});
  marsBot.marsBotBoard.tracks[TRACK.power].position = energy;
  // The top of the project deck is the end of the draw pile
  marsBot.game.projectDeck.drawPile.push(...topCards.toReversed());
  return {marsBot, played};
}

function hyperlinkGame(energy: number, topCards: Array<IProjectCard>) {
  const {game, marsBot} = createAutomaGame();
  marsBot.marsBotBoard.tracks[4].position = energy;
  // The top of the project deck is the end of the draw pile
  game.projectDeck.drawPile.push(...[...topCards].reverse());
  const played: Array<IProjectCard> = [];
  marsBot.turnResolver.resolveProjectCard = (card) => {
    played.push(card);
  };
  return {game, marsBot, played};
}

describe('InterfaceHyperlink', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {
      energy: 4,
      deck: [CardName.TARDIGRADES, CardName.ASTEROID, CardName.GIANT_ICE_ASTEROID, CardName.SEARCH_FOR_LIFE],
      expected: {
        played: [CardName.SEARCH_FOR_LIFE, CardName.GIANT_ICE_ASTEROID],
        discarded: [CardName.ASTEROID, CardName.TARDIGRADES],
      },
    },
    // Mine and Power Plant both cost 4 M€
    {
      energy: 3,
      deck: [CardName.MINE, CardName.POWER_PLANT, CardName.SEARCH_FOR_LIFE],
      expected: {
        played: [CardName.SEARCH_FOR_LIFE, CardName.POWER_PLANT],
        discarded: [CardName.MINE],
      },
    },
    {
      energy: 0,
      deck: [CardName.MINE, CardName.POWER_PLANT, CardName.SEARCH_FOR_LIFE],
      expected: {
        played: [CardName.POWER_PLANT, CardName.MINE],
        discarded: [],
      },
    },
  ] as const) {
    it('draws 1 card per energy space, at least 2, and plays science, then the most expensive, then the most tags: ' + JSON.stringify(run), () => {
      const {marsBot, played} = hyperlinkBot(run.energy, cardsFromJSON(run.deck));
      const discardPile = marsBot.game.projectDeck.discardPile;
      const discardsBefore = discardPile.length;

      const destroyed = new InterfaceHyperlink().resolve(marsBot);

      const playedNames = played.map((card) => card.name);
      const discardedNames = discardPile.slice(discardsBefore).map((card) => card.name);
      expect(playedNames).deep.eq(run.expected.played);
      expect(discardedNames).deep.eq(run.expected.discarded);
      expect(destroyed).is.true;
    });
  }

  // A wild tag counts as a tag (Nick, Q&A 19)
  it('counts wild tags in the tag tiebreak', () => {
    const building = fakeCard({cost: 4, tags: [Tag.BUILDING]});
    const twoWild = fakeCard({cost: 4, tags: [Tag.WILD, Tag.WILD]});
    const searchForLife = new SearchForLife();
    const {marsBot, played} = hyperlinkBot(3, [building, twoWild, searchForLife]);

    new InterfaceHyperlink().resolve(marsBot);

    expect(played).deep.eq([searchForLife, twoWild]);
  });

  it('is kept when the project deck is empty', () => {
    const {marsBot, played} = hyperlinkBot(4, []);
    marsBot.game.projectDeck.drawPile.length = 0;
    marsBot.game.projectDeck.discardPile.length = 0;

    const destroyed = new InterfaceHyperlink().resolve(marsBot);

    expect(played).is.empty;
    expect(destroyed).is.false;
  });

  it('draws a card per energy space and plays the science card and the most expensive one', () => {
    const searchForLife = new SearchForLife();
    const tardigrades = new Tardigrades();
    const asteroid = new Asteroid();
    const giantIceAsteroid = new GiantIceAsteroid();
    const {game, marsBot, played} = hyperlinkGame(4, [tardigrades, asteroid, giantIceAsteroid, searchForLife]);

    const destroyed = marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.INTERFACE_HYPERLINK));

    expect(played).deep.eq([searchForLife, giantIceAsteroid]);
    expect(game.projectDeck.discardPile).to.include.members([tardigrades, asteroid]);
    expect(destroyed).is.true;
    const discardedIds = marsBot.bonusDeck.discardPile.map((c) => c.name);
    expect(discardedIds).to.not.include(BonusCardName.INTERFACE_HYPERLINK);
  });

  it('breaks a cost tie toward the card with more tags', () => {
    const mine = new Mine();
    const powerPlant = new PowerPlant();
    const searchForLife = new SearchForLife();
    const {marsBot, played} = hyperlinkGame(3, [mine, powerPlant, searchForLife]);

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.INTERFACE_HYPERLINK));

    expect(played).deep.eq([searchForLife, powerPlant]);
  });

  // A wild tag counts as a tag (Nick, Q&A 19)
  it('counts wild tags in the tag tiebreak', () => {
    const building = fakeCard({cost: 4, tags: [Tag.BUILDING]});
    const twoWild = fakeCard({cost: 4, tags: [Tag.WILD, Tag.WILD]});
    const searchForLife = new SearchForLife();
    const {marsBot, played} = hyperlinkGame(3, [building, twoWild, searchForLife]);

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.INTERFACE_HYPERLINK));

    expect(played).deep.eq([searchForLife, twoWild]);
  });

  it('draws at least 2 cards, even with the energy track at 0', () => {
    const mine = new Mine();
    const searchForLife = new SearchForLife();
    const {marsBot, played} = hyperlinkGame(0, [mine, searchForLife]);

    const destroyed = marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.INTERFACE_HYPERLINK));

    expect(played).deep.eq([searchForLife, mine]);
    expect(destroyed).is.true;
    const discardedIds = marsBot.bonusDeck.discardPile.map((c) => c.name);
    expect(discardedIds).to.not.include(BonusCardName.INTERFACE_HYPERLINK);
  });
});
