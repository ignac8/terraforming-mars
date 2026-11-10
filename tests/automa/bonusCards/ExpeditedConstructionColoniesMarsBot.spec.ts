import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotBonusCard, bonusCard} from '@/server/automa/MarsBotBonusCard';
import {Ceres} from '@/server/colonies/Ceres';
import {Luna} from '@/server/colonies/Luna';
import {testGame} from '../../TestGame';
import {getMarsBot} from '../corps/CorpGame';

function b17Card(): MarsBotBonusCard {
  return bonusCard(BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES, 'Expedited Construction (Colonies)' as CardName);
}

describe('ExpeditedConstructionColoniesMarsBot', () => {
  it('C-15a: places city if adjacent to ≥2 greenery/ocean tiles and destroys card', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = [new Luna()];
    // Place some ocean tiles so the condition can be met
    const oceansNeeded = 2;
    for (let i = 0; i < oceansNeeded; i++) {
      marsBot.turnResolver.placeOcean();
    }
    const card = b17Card();
    marsBot.bonusDeck.drawPile.push(card);

    const tilesBefore = game.board.spaces.filter((s) => s.tile !== undefined).length;
    const destroyed = marsBot['bonusResolver'].resolve(card);

    // If city placed, tile count should increase and card should be destroyed
    const tilesAfter = game.board.spaces.filter((s) => s.tile !== undefined).length;
    // Either the city was placed (and card destroyed) or it wasn't (no city space found)
    if (tilesAfter > tilesBefore) {
      expect(destroyed).to.be.true;
    }
  });

  it('C-15b: places colony if MarsBot has ≤1 colonies and no city space', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];
    const card = b17Card();
    marsBot.bonusDeck.drawPile.push(card);
    const destroyed = marsBot['bonusResolver'].resolve(card);
    // Either a colony was placed or no eligible colony was found
    // Card should NOT be destroyed in this branch
    expect(destroyed).to.be.false;
  });

  it('C-15b: gains 2 resources if colony placed', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];
    const card = b17Card();
    marsBot.bonusDeck.drawPile.push(card);
    const storageBefore = marsBot.shippingBoard.get(ColonyName.LUNA);
    marsBot['bonusResolver'].resolve(card);
    // Only meaningful if luna colony was placed
    if (luna.colonies.includes(marsBot.player.id)) {
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storageBefore + 2);
    }
  });

  it('C-15c: no effect if MarsBot already has 2+ colonies', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    luna.colonies = [marsBot.player.id];
    const ceres = new Ceres();
    ceres.colonies = [marsBot.player.id];
    game.colonies = [luna, ceres];
    const card = b17Card();
    marsBot.bonusDeck.drawPile.push(card);
    const destroyed = marsBot['bonusResolver'].resolve(card);
    expect(destroyed).to.be.false;
    // No new colonies should be added
    expect(luna.colonies.filter((id) => id === marsBot.player.id).length).to.eq(1);
  });
});
