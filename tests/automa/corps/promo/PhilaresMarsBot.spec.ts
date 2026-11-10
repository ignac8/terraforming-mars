import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {SpaceType} from '@/common/boards/SpaceType';
import {CardName} from '@/common/cards/CardName';
import {IGame} from '@/server/IGame';
import {MarsBot} from '@/server/automa/MarsBot';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {PHILARES_MARSBOT_CORP} from '@/server/automa/corps/promo/PhilaresMarsBot';
import {Space} from '@/server/boards/Space';
import {testGame} from '../../../TestGame';
import {TestPlayer} from '../../../TestPlayer';
import {AutomaGame, createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {RecordingMarsBot, recordingMarsBot} from '../RecordingMarsBot';

type Sides = RecordingMarsBot & {botPlayer: TestPlayer, human: TestPlayer};

/** A recording bot on a 2-player game. `botPlayer` owns MarsBot's tiles. */
function sides(): Sides {
  const [game, human, botPlayer] = testGame(2);
  return {...recordingMarsBot({game, player: botPlayer, humanPlayer: human}), botPlayer, human};
}

/** Puts `others` tiles of the other side and `own` of the placer's around an empty space, puts a tile on it and runs Philares. */
function placeTile({marsBot, botPlayer, human}: Sides, byMarsBot: boolean, tileType: TileType, others: number, own: number = 0): void {
  const [placer, other] = byMarsBot ? [botPlayer, human] : [human, botPlayer];
  const board = marsBot.game.board;
  const space = board.getAvailableSpacesOnLand(placer).find((s) => {
    const adjacent = board.getAdjacentSpaces(s);
    return adjacent.length === 6 && adjacent.every((a) => a.spaceType === SpaceType.LAND && a.tile === undefined);
  })!;
  board.getAdjacentSpaces(space).slice(0, others + own).forEach((s, i) => {
    marsBot.game.simpleAddTile(i < others ? other : placer, s, {tileType: TileType.GREENERY});
  });
  marsBot.game.simpleAddTile(placer, space, {tileType});

  PHILARES_MARSBOT_CORP.effect!.onTilePlaced!(marsBot, byMarsBot, tileType, space);
}

/** An empty land space with no tile within two spaces of it. */
function quietSpace(game: IGame, marsBot: MarsBot): Space {
  const board = game.board;
  return board.getAvailableSpacesOnLand(marsBot.player).find((space) => {
    const adj = board.getAdjacentSpaces(space);
    return adj.length === 6 && adj.every((s) => s.spaceType === SpaceType.LAND &&
      board.getAdjacentSpaces(s).every((t) => t.tile === undefined));
  })!;
}

function createPhilaresGame(): AutomaGame {
  const {game, human, marsBot} = createAutomaGame();
  marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PHILARES)!);
  marsBot.setCorpState('scienceResources', 0);
  return {game, human, marsBot};
}

describe('PhilaresMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('places a greenery, resolves Local Neural Instance and starts with one science resource', () => {
    const {marsBot, calls, corpState} = sides();

    PHILARES_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['placeGreenery()', 'removeBonusCard(B07)', 'resolveBonusCard(B07)', 'addBonusCardToBonusDeck(B27)']);
    expect(corpState.get('scienceResources')).eq(1);
  });

  // C22: each adjacency between the two sides' tiles, whoever just placed the tile
  for (const byMarsBot of [true, false]) {
    it(`gains a science resource for each of the other side's tiles that a tile placed by ${byMarsBot ? 'MarsBot' : 'the player'} touches`, () => {
      const bot = sides();

      placeTile(bot, byMarsBot, TileType.CITY, 2, 1);

      expect(bot.corpState.get('scienceResources')).eq(2);
    });
  }

  it('spends 4 science resources per advance of its most-advanced track that is not maxed, but not for oceans or after the game has ended', () => {
    const bot = sides();
    const {marsBot, calls, corpState} = bot;
    marsBot.marsBotBoard.tracks[0].position = marsBot.marsBotBoard.tracks[0].definition.layout.length - 1;
    marsBot.marsBotBoard.tracks[1].position = 10;

    placeTile(bot, true, TileType.OCEAN, 1);
    expect(corpState.get('scienceResources')).is.undefined;

    corpState.set('scienceResources', 7);
    placeTile(bot, true, TileType.CITY, 1);
    expect(calls).deep.eq(['advanceTrack(1)', 'advanceTrack(1)']);
    expect(corpState.get('scienceResources')).eq(0);

    // Nothing advances after the game has ended (BGG 3513998)
    marsBot.game.phase = Phase.END;
    corpState.set('scienceResources', 3);
    placeTile(bot, true, TileType.CITY, 1);
    expect(calls).has.length(2);
    expect(corpState.get('scienceResources')).eq(4);
  });

  it('setup places a greenery, resolves Local Neural Instance and removes it', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.addBonusCardToActionDeck(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PHILARES)!);

    expect(game.board.getGreeneries(marsBot.player)).has.length(1);
    expect(marsBot.neuralInstanceSpace?.tile?.tileType).to.eq(TileType.NEURAL_INSTANCE);
    expect(marsBot.getCorpState('scienceResources')).to.eq(1);
    const bonusIds = [...marsBot.bonusDeck.drawPile, ...marsBot.bonusDeck.discardPile].map((c) => c.id);
    expect(bonusIds).does.not.include(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);
    expect(bonusIds).includes(BonusCardId.B27_BUILD_BUILD_BUILD);
    expect(marsBot.actionDeck.some((c) => 'id' in c && c.id === BonusCardId.B07_LOCAL_NEURAL_INSTANCE)).is.false;
  });

  it('setup does not count Local Neural Instance as a destroyed bonus card', () => {
    const {marsBot} = createPhilaresGame();

    expect(marsBot.destroyedBonusCards).to.eq(0);
  });

  it('gains a science resource when MarsBot places a tile next to a tile of the player', () => {
    const {game, human, marsBot} = createPhilaresGame();
    const space = quietSpace(game, marsBot);
    game.simpleAddTile(human, game.board.getAdjacentSpaces(space)[0], {tileType: TileType.GREENERY});

    game.addCity(marsBot.player, space);

    expect(marsBot.getCorpState('scienceResources')).to.eq(1);
  });

  it('gains a science resource when the player places a tile next to a tile of MarsBot', () => {
    const {game, human, marsBot} = createPhilaresGame();
    const space = quietSpace(game, marsBot);
    game.simpleAddTile(marsBot.player, game.board.getAdjacentSpaces(space)[0], {tileType: TileType.GREENERY});

    game.addCity(human, space);

    expect(marsBot.getCorpState('scienceResources')).to.eq(1);
  });

  it('gains one science resource for each tile of the other side that the new tile touches', () => {
    const {game, human, marsBot} = createPhilaresGame();
    const space = quietSpace(game, marsBot);
    const [first, second] = game.board.getAdjacentSpaces(space);
    game.simpleAddTile(human, first, {tileType: TileType.GREENERY});
    game.simpleAddTile(human, second, {tileType: TileType.GREENERY});

    game.addCity(marsBot.player, space);

    expect(marsBot.getCorpState('scienceResources')).to.eq(2);
  });

  it('spends 4 science resources to advance the most advanced track that is not maxed', () => {
    const {game, human, marsBot} = createPhilaresGame();
    marsBot.setCorpState('scienceResources', 3);
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[0].position = tracks[0].definition.layout.length - 1;
    tracks[1].position = 10;
    const advanced: Array<number> = [];
    marsBot.turnResolver.advanceTrack = (i) => {
      advanced.push(i);
      return true;
    };
    const space = quietSpace(game, marsBot);
    game.simpleAddTile(human, game.board.getAdjacentSpaces(space)[0], {tileType: TileType.GREENERY});

    game.addCity(marsBot.player, space);

    expect(advanced).to.deep.eq([1]);
    expect(marsBot.getCorpState('scienceResources')).to.eq(0);
  });
});
