import {expect} from 'chai';
import {testGame} from '../../../TestGame';
import {AutomaGameHooks} from '../../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../../src/server/automa/MarsBot';
import {CardName} from '../../../../src/common/cards/CardName';
import {Luna} from '../../../../src/server/colonies/Luna';
import {Titan} from '../../../../src/server/colonies/Titan';
import {BoardName} from '../../../../src/common/boards/BoardName';
import {getMarsBotCorp} from '../../../../src/server/automa/corps/MarsBotCorpRegistry';
import {MarsBotCorpResolver} from '../../../../src/server/automa/corps/MarsBotCorpResolver';
import {Game} from '../../../../src/server/Game';
import {CubeType} from '../../../../src/common/automa/AutomaTypes';
import {Tag} from '../../../../src/common/cards/Tag';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('AridorSetup', () => {
  it('adds one colony tile to the game at setup without building a colony', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const inPlay = game.colonies.map((c) => c.name);
    const outOfPlay = game.discardedColonies.length;

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARIDOR)!);

    expect(game.colonies).has.length(inPlay.length + 1);
    const added = game.colonies.find((c) => !inPlay.includes(c.name))!;
    expect(game.discardedColonies).has.length(outOfPlay - 1);
    expect(game.discardedColonies).does.not.include(added);
    expect(game.colonies.some((c) => c.colonies.includes(marsBot.player.id))).is.false;
    expect(marsBot.shippingBoard.storage.size).to.eq(0);
  });

  it('starts the added tile active, as C-1 starts every colony tile in a MarsBot game', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const titan = new Titan();
    game.discardedColonies = [titan];

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARIDOR)!);

    expect(game.colonies).includes(titan);
    expect(titan.isActive).is.true;
  });

  it('adds nothing when every colony tile is already in play', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.discardedColonies.length = 0;
    const inPlay = game.colonies.length;

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARIDOR)!);

    expect(game.colonies).has.length(inPlay);
    expect(game.colonies.some((c) => c.colonies.includes(marsBot.player.id))).is.false;
  });

  it('maybePlaceRandomColony returns true when eligible colony exists', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    const placed = marsBot.maybePlaceRandomColony();
    expect(placed).to.be.true;
    expect(luna.colonies).to.include(marsBot.player.id);
  });

  it('maybePlaceRandomColony returns false when no eligible colonies', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = []; // No colonies in game

    const placed = marsBot.maybePlaceRandomColony();
    expect(placed).to.be.false;
  });

  it('gains 2 resources to shipping board after colony placement', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    const initialStorage = marsBot.shippingBoard.get(luna.name);
    marsBot.maybePlaceRandomColony();
    expect(marsBot.shippingBoard.get(luna.name)).to.eq(initialStorage + 2);
  });

  // The card names the tracks: "Jovian track #6" (white) and "city track #6" (black). Which row
  // carries those tags depends on the map.
  describe('the Jovian and city cubes', () => {
    const EVENT = 2;
    const boards: Array<[BoardName, number, number]> = [
      [BoardName.THARSIS, 4, 5],
      [BoardName.UTOPIA_PLANITIA, 4, 5],
      [BoardName.HELLAS, 3, 5],
      [BoardName.ELYSIUM, 3, 5],
      [BoardName.TERRA_CIMMERIA_NOVA, 5, 3],
      [BoardName.VASTITAS_BOREALIS_NOVA, 5, 4],
    ];

    function setUp(boardName: BoardName): MarsBot {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName});
      const marsBot = getMarsBot(game);
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARIDOR)!);
      return marsBot;
    }

    for (const [boardName, jovian, city] of boards) {
      it(`sit on the Jovian and city tracks of ${boardName}`, () => {
        const marsBot = setUp(boardName);
        const cube = (trackIndex: number, position: number) => marsBot.hasCubeAt(trackIndex, position)?.cubeType;

        expect(marsBot.marsBotBoard.definitions[jovian].tags).includes(Tag.JOVIAN);
        expect(marsBot.marsBotBoard.definitions[city].tags).includes(Tag.CITY);
        const expected: Array<[number, number, CubeType]> = [
          [0, 3, 'white'], [1, 3, 'white'], [3, 3, 'white'], [4, 3, 'white'], [jovian, 6, 'white'],
          [5, 3, 'black'], [city, 6, 'black'], [6, 3, 'black'], [6, 6, 'black'],
        ];
        for (const [trackIndex, position, cubeType] of expected) {
          expect(cube(trackIndex, position), `track ${trackIndex} #${position}`).to.eq(cubeType);
        }
        // Nine cubes on nine different spaces
        expect(new Set(expected.map(([t, p]) => `${t}:${p}`)).size).to.eq(9);
      });

      it(`advance the event track from the Jovian cube on ${boardName}`, () => {
        const marsBot = setUp(boardName);
        const event = marsBot.marsBotBoard.tracks[EVENT].position;

        MarsBotCorpResolver.onTrackAdvanced(marsBot, jovian, 6);

        // The event track's icons can move it on further
        expect(marsBot.marsBotBoard.tracks[EVENT].position).to.be.above(event);
      });
    }

    it('leave no cube on Hellas\'s energy track #6', () => {
      const marsBot = setUp(BoardName.HELLAS);
      const event = marsBot.marsBotBoard.tracks[EVENT].position;

      expect(marsBot.hasCubeAt(4, 6)).is.undefined;
      MarsBotCorpResolver.onTrackAdvanced(marsBot, 4, 6);
      expect(marsBot.marsBotBoard.tracks[EVENT].position).to.eq(event);
    });

    it('stay where a game saved before the fix had them', () => {
      const marsBot = setUp(BoardName.HELLAS);
      const serialized = marsBot.game.serialize();
      const jovianCube = serialized.automaState!.trackCubePositions!.find((c) => c.trackIndex === 3 && c.position === 6)!;
      jovianCube.trackIndex = 4;

      const restored = getMarsBot(Game.deserialize(serialized));

      expect(restored.hasCubeAt(4, 6)?.cubeType).to.eq('white');
      expect(restored.hasCubeAt(3, 6)).is.undefined;
    });
  });

  it('corp name is Aridor', () => {
    expect(CardName.ARIDOR).to.not.be.undefined;
  });
});
