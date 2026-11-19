import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {ExpeditedConstructionMarsBot} from '@/server/automa/bonusCards/ExpeditedConstructionMarsBot';
import {testGame} from '../../TestGame';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

describe('ExpeditedConstructionMarsBot', () => {
  // Space 12 is next to all three oceans and has no icons, so the city earns 2 M€ per ocean
  it('places a city next to 2 greenery or ocean tiles, earns its placement M€ and is destroyed', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0});
    for (const id of ['06', '07', '13'] as const) {
      game.simpleAddTile(human, game.board.getSpaceOrThrow(id), {tileType: TileType.OCEAN});
    }

    const destroyed = new ExpeditedConstructionMarsBot().resolve(marsBot);

    const city = game.board.getSpaceOrThrow('12');
    expect(city.tile?.tileType).eq(TileType.CITY);
    expect(city.player).eq(botPlayer);
    expect(calls).deep.eq(['gainMc(6)']);
    expect(destroyed).is.true;
  });

  it('places nothing and is kept when no space is next to 2 such tiles', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0});

    const destroyed = new ExpeditedConstructionMarsBot().resolve(marsBot);

    expect(game.board.spaces.filter((space) => space.tile !== undefined)).is.empty;
    expect(calls).is.empty;
    expect(destroyed).is.false;
  });

  // 12 is the one space next to two of these oceans. It has no icons, and each ocean next to a city pays 2 M€
  it('places a city next to 2 greenery or ocean tiles, earns the M€ of the space and is destroyed', () => {
    const {game, human, marsBot} = createAutomaGame();
    for (const id of ['06', '07', '13'] as const) {
      game.simpleAddTile(human, game.board.getSpaceOrThrow(id), {tileType: TileType.OCEAN});
    }
    const megacredits = marsBot.turnResolver.megacredits;
    const card = createBonusCard(BonusCardId.B05_EXPEDITED_CONSTRUCTION);

    const destroyed = marsBot['bonusResolver'].resolve(card);

    const city = game.board.getSpaceOrThrow('12');
    expect(city.tile?.tileType).eq(TileType.CITY);
    expect(city.player).eq(marsBot.player);
    expect(marsBot.turnResolver.megacredits).eq(megacredits + 6);
    expect(destroyed).is.true;
    expect(marsBot.bonusDeck.discardPile).does.not.include(card);
  });

  it('takes no Failed Action and goes back to the bonus deck when no space is next to 2 such tiles', () => {
    const {game, marsBot} = createAutomaGame();
    const megacredits = marsBot.turnResolver.megacredits;
    const card = createBonusCard(BonusCardId.B05_EXPEDITED_CONSTRUCTION);

    const destroyed = marsBot['bonusResolver'].resolve(card);

    expect(game.board.spaces.filter((space) => space.tile !== undefined)).is.empty;
    expect(marsBot.turnResolver.megacredits).eq(megacredits);
    expect(destroyed).is.false;
    expect(marsBot.bonusDeck.discardPile).includes(card);
  });
});
