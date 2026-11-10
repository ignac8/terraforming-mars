import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {Tag} from '@/common/cards/Tag';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {GiantIceAsteroid} from '@/server/cards/base/GiantIceAsteroid';
import {Mine} from '@/server/cards/base/Mine';
import {PowerPlant} from '@/server/cards/base/PowerPlant';
import {SearchForLife} from '@/server/cards/base/SearchForLife';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {fakeCard} from '../../TestingUtils';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';

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

describe('InterfaceHyperlinkMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('draws a card per energy space and plays the science card and the most expensive one', () => {
    const searchForLife = new SearchForLife();
    const tardigrades = new Tardigrades();
    const asteroid = new Asteroid();
    const giantIceAsteroid = new GiantIceAsteroid();
    const {game, marsBot, played} = hyperlinkGame(4, [tardigrades, asteroid, giantIceAsteroid, searchForLife]);

    const destroyed = marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B30_INTERFACE_HYPERLINK));

    expect(played).deep.eq([searchForLife, giantIceAsteroid]);
    expect(game.projectDeck.discardPile).to.include.members([tardigrades, asteroid]);
    expect(destroyed).is.true;
    expect(marsBot.bonusDeck.discardPile.map((c) => c.id)).to.not.include(BonusCardId.B30_INTERFACE_HYPERLINK);
  });

  it('breaks a cost tie toward the card with more tags', () => {
    const mine = new Mine();
    const powerPlant = new PowerPlant();
    const searchForLife = new SearchForLife();
    const {marsBot, played} = hyperlinkGame(3, [mine, powerPlant, searchForLife]);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B30_INTERFACE_HYPERLINK));

    expect(played).deep.eq([searchForLife, powerPlant]);
  });

  // A wild tag counts as a tag (Nick, Q&A 19)
  it('counts wild tags in the tag tiebreak', () => {
    const building = fakeCard({cost: 4, tags: [Tag.BUILDING]});
    const twoWild = fakeCard({cost: 4, tags: [Tag.WILD, Tag.WILD]});
    const searchForLife = new SearchForLife();
    const {marsBot, played} = hyperlinkGame(3, [building, twoWild, searchForLife]);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B30_INTERFACE_HYPERLINK));

    expect(played).deep.eq([searchForLife, twoWild]);
  });

  it('draws at least 2 cards, even with the energy track at 0', () => {
    const mine = new Mine();
    const searchForLife = new SearchForLife();
    const {marsBot, played} = hyperlinkGame(0, [mine, searchForLife]);

    const destroyed = marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B30_INTERFACE_HYPERLINK));

    expect(played).deep.eq([searchForLife, mine]);
    expect(destroyed).is.true;
    expect(marsBot.bonusDeck.discardPile.map((c) => c.id)).to.not.include(BonusCardId.B30_INTERFACE_HYPERLINK);
  });
});
