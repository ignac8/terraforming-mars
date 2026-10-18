import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions} from '@tests/TestingUtils';
import {CardName} from '@/common/cards/CardName';
import {SpaceName} from '@/common/boards/SpaceName';
import {newProjectCard} from '@/server/createCard';
import {Board} from '@/server/boards/Board';

const options = {
  boardName: BoardName.AMAZONIS_PLANITIA,
  promoCardsOption: true,
  venusNextExtension: true,
  pathfindersExpansion: true,
  coloniesExtension: true,
  turmoilExtension: true,
  underworldExpansion: true,
  moonExpansion: true,
  aresExtension: true,
  preludeExtension: true,
  prelude2Expansion: true,
  ceoExtension: true,
  communityCardsOption: true,
};

describe('probe misc: Amazonis space-colony cards', () => {
  const cases: Array<[CardName, string]> = [
    [CardName.GANYMEDE_COLONY, SpaceName.GANYMEDE_COLONY],
    [CardName.PHOBOS_SPACE_HAVEN, SpaceName.PHOBOS_SPACE_HAVEN],
    [CardName.STANFORD_TORUS, SpaceName.STANFORD_TORUS],
    [CardName.LUNA_METROPOLIS, SpaceName.LUNA_METROPOLIS],
    [CardName.DAWN_CITY, SpaceName.DAWN_CITY],
    [CardName.STRATOPOLIS, SpaceName.STRATOPOLIS],
    [CardName.MAXWELL_BASE, SpaceName.MAXWELL_BASE],
    [CardName.CERES_SPACEPORT, SpaceName.CERES_SPACEPORT],
    [CardName.DYSON_SCREENS, SpaceName.DYSON_SCREENS],
    [CardName.LUNAR_EMBASSY, SpaceName.LUNAR_EMBASSY],
    [CardName.VENERA_BASE, SpaceName.VENERA_BASE],
  ];
  for (const [cardName, spaceId] of cases) {
    it(`${cardName} puts a city on ${spaceId}`, () => {
      const [game, player] = testGame(2, options);
      const space = game.board.getSpaceOrThrow(spaceId as any);
      const card = newProjectCard(cardName)!;
      card.play(player);
      runAllActions(game);
      expect(Board.isCitySpace(space), 'city on space').is.true;
    });
  }
});
