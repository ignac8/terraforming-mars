import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {SpaceType} from '@/common/boards/SpaceType';
import {CardName} from '@/common/cards/CardName';
import {IGame} from '@/server/IGame';
import {MarsBot} from '@/server/automa/MarsBot';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {Space} from '@/server/boards/Space';
import {Capital} from '@/server/cards/base/Capital';
import {NuclearZone} from '@/server/cards/base/NuclearZone';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';

/** An empty land space with no tile within two spaces of it. */
function quietSpace(game: IGame, marsBot: MarsBot): Space {
  const board = game.board;
  return board.getAvailableSpacesOnLand(marsBot.player).find((space) => {
    const adj = board.getAdjacentSpaces(space);
    return adj.length === 6 && adj.every((s) => s.spaceType === SpaceType.LAND &&
      board.getAdjacentSpaces(s).every((t) => t.tile === undefined));
  })!;
}

describe('BuildBuildBuildMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('a. places a city next to the greenery of the player, then loses 5 M€', () => {
    const {game, human, marsBot} = createAutomaGame();
    const greenery = quietSpace(game, marsBot);
    game.simpleAddTile(human, greenery, {tileType: TileType.GREENERY});
    marsBot.megacredits = 20;
    const card = createBonusCard(BonusCardId.B27_BUILD_BUILD_BUILD);

    marsBot['bonusResolver'].resolve(card);

    const cities = game.board.getCities(marsBot.player);
    expect(cities).has.length(1);
    expect(game.board.getAdjacentSpaces(cities[0])).includes(greenery);
    const placementMc = marsBot['tilePlacer'].getTotalPlacementMC(cities[0]);
    expect(marsBot.megacredits).to.eq(20 + placementMc - 5);
    expect(marsBot.bonusDeck.discardPile).includes(card);
  });

  it('b. places the special tile of a card it played next to the city of the player, then loses the card and 3 M€', () => {
    const {game, human, marsBot} = createAutomaGame();
    const city = quietSpace(game, marsBot);
    game.simpleAddTile(human, city, {tileType: TileType.CITY});
    const nuclearZone = new NuclearZone();
    marsBot.playedProjectCards.push(nuclearZone);
    marsBot.megacredits = 10;

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B27_BUILD_BUILD_BUILD));

    const space = game.board.getSpaceByTileCard(CardName.NUCLEAR_ZONE)!;
    expect(space.tile?.tileType).to.eq(TileType.NUCLEAR_ZONE);
    expect(space.player).to.eq(marsBot.player);
    expect(game.board.getAdjacentSpaces(space)).includes(city);
    expect(marsBot.playedProjectCards).does.not.include(nuclearZone);
    const placementMc = marsBot['tilePlacer'].getTotalPlacementMC(space);
    expect(marsBot.megacredits).to.eq(10 + placementMc - 3);
  });

  it('b. leaves out a played Capital, which is a city', () => {
    const {game, human, marsBot} = createAutomaGame();
    game.simpleAddTile(human, quietSpace(game, marsBot), {tileType: TileType.CITY});
    marsBot.playedProjectCards.push(new Capital());

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B27_BUILD_BUILD_BUILD));

    expect(game.board.getSpaceByTileCard(CardName.CAPITAL)).is.undefined;
    expect(marsBot.megacredits).to.eq(3);
  });

  it('c. with nothing to build, gains 3 M€ and shuffles the card back into the bonus deck', () => {
    const {game, marsBot} = createAutomaGame();
    const card = createBonusCard(BonusCardId.B27_BUILD_BUILD_BUILD);

    marsBot['bonusResolver'].resolve(card);

    expect(game.board.getCities(marsBot.player)).is.empty;
    expect(marsBot.megacredits).to.eq(3);
    expect(marsBot.bonusDeck.drawPile).includes(card);
    expect(marsBot.bonusDeck.discardPile).does.not.include(card);
  });
});
