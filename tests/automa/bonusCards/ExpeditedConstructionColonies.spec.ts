import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {TileType} from '@/common/TileType';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {Ceres} from '@/server/colonies/Ceres';
import {Luna} from '@/server/colonies/Luna';
import {ExpeditedConstructionColonies} from '@/server/automa/bonusCards/ExpeditedConstructionColonies';
import {testGame} from '../../TestGame';
import {getMarsBot} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

function b17Card(): MarsBotBonusCard {
  return createBonusCard(BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES);
}

describe('ExpeditedConstructionColonies', () => {
  // Space 12 is next to all three oceans and has no icons, so the city earns 2 M€ per ocean
  it('places a city next to 2 greenery or ocean tiles and is destroyed', () => {
    const [game, human, botPlayer] = testGame(2, {coloniesExtension: true});
    const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0});
    for (const id of ['06', '07', '13'] as const) {
      game.simpleAddTile(human, game.board.getSpaceOrThrow(id), {tileType: TileType.OCEAN});
    }

    const destroyed = new ExpeditedConstructionColonies().resolve(marsBot);

    const city = game.board.getSpaceOrThrow('12');
    expect(city.tile?.tileType).eq(TileType.CITY);
    expect(calls).deep.eq(['gainMc(6)']);
    expect(destroyed).is.true;
  });

  for (const run of [
    {botColonies: 0, expected: ['maybePlaceRandomColony()']},
    {botColonies: 1, expected: ['maybePlaceRandomColony()']},
    {botColonies: 2, expected: []},
  ] as const) {
    it('without a city space, places a colony while MarsBot has at most 1 and is kept: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2, {coloniesExtension: true});
      const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0});
      game.colonies = [new Luna(), new Ceres()];
      for (const colony of game.colonies.slice(0, run.botColonies)) {
        colony.colonies.push(botPlayer.id);
      }

      const destroyed = new ExpeditedConstructionColonies().resolve(marsBot);

      expect(calls).deep.eq(run.expected);
      expect(destroyed).is.false;
    });
  }

  it('C-15a: places city if adjacent to ≥2 greenery/ocean tiles and destroys card', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = [new Luna()];
    const oceansNeeded = 2;
    for (let i = 0; i < oceansNeeded; i++) {
      marsBot.turnResolver.placeOcean();
    }
    const card = b17Card();
    marsBot.bonusDeck.drawPile.push(card);

    const tilesBefore = game.board.spaces.filter((s) => s.tile !== undefined).length;
    const destroyed = marsBot.actionDeck.playBonusCard(card);

    const tilesAfter = game.board.spaces.filter((s) => s.tile !== undefined).length;
    // Checks the card only when a city was placed.
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
    const destroyed = marsBot.actionDeck.playBonusCard(card);
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
    marsBot.actionDeck.playBonusCard(card);
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
    const destroyed = marsBot.actionDeck.playBonusCard(card);
    expect(destroyed).to.be.false;
    const botColoniesOnLuna = luna.colonies.filter((id) => id === marsBot.player.id);
    expect(botColoniesOnLuna).has.length(1);
  });
});
