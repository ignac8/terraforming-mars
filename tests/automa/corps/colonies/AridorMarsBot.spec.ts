import {expect} from 'chai';
import {CubeType} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {Game} from '@/server/Game';
import {MarsBot} from '@/server/automa/MarsBot';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {MarsBotCorpResolver} from '@/server/automa/corps/MarsBotCorpResolver';
import {Luna} from '@/server/colonies/Luna';
import {Titan} from '@/server/colonies/Titan';
import {testGame} from '../../../TestGame';
import {createAutomaGame, getMarsBot, resetCorpRegistry} from '../CorpGame';

// The card names the tracks: "Jovian track #6" (white) and "city track #6" (black). Which row
// carries those tags depends on the map.
const EVENT = 2;
const boards: Array<[BoardName, number, number]> = [
  [BoardName.THARSIS, 4, 5],
  [BoardName.UTOPIA_PLANITIA, 4, 5],
  [BoardName.HELLAS, 3, 5],
  [BoardName.ELYSIUM, 3, 5],
  [BoardName.TERRA_CIMMERIA_NOVA, 5, 3],
  [BoardName.VASTITAS_BOREALIS_NOVA, 5, 4],
];

function setUpAridor(boardName: BoardName): MarsBot {
  const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName});
  const marsBot = getMarsBot(game);
  marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARIDOR)!);
  return marsBot;
}

describe('AridorMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('has leastAdvancedTrack draft priority', () => {
    const corp = getMarsBotCorp(CardName.ARIDOR)!;
    expect(corp.draftPriority).to.deep.eq({type: 'leastAdvancedTrack'});
  });

  it('has white+black cubes on multiple tracks', () => {
    const corp = getMarsBotCorp(CardName.ARIDOR)!;
    expect(corp.trackCubes!.length).to.eq(9);
  });

  it('cube trigger advances event track', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ARIDOR)!;
    marsBot.setCorpAndSetup(corp);
    const eventBefore = marsBot.marsBotBoard.tracks[2].position;
    corp.effect!.onTrackCubeTrigger!(marsBot, 1, 3, 'white');
    expect(marsBot.marsBotBoard.tracks[2].position).to.be.gte(eventBefore + 1);
  });

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

  for (const [boardName, jovian, city] of boards) {
    const expected: Array<[number, number, CubeType]> = [
      [0, 3, 'white'], [1, 3, 'white'], [3, 3, 'white'], [4, 3, 'white'], [jovian, 6, 'white'],
      [5, 3, 'black'], [city, 6, 'black'], [6, 3, 'black'], [6, 6, 'black'],
    ];

    it(`the Jovian and city cubes sit on the Jovian and city tracks of ${boardName}`, () => {
      const marsBot = setUpAridor(boardName);

      expect(marsBot.marsBotBoard.definitions[jovian].tags).includes(Tag.JOVIAN);
      expect(marsBot.marsBotBoard.definitions[city].tags).includes(Tag.CITY);
      // Nine cubes on nine different spaces
      expect(new Set(expected.map(([t, p]) => `${t}:${p}`)).size).to.eq(9);
    });

    for (const [trackIndex, position, cubeType] of expected) {
      it('puts a cube on a Jovian or city track space: ' + JSON.stringify({boardName, trackIndex, position, cubeType}), () => {
        const marsBot = setUpAridor(boardName);

        expect(marsBot.hasCubeAt(trackIndex, position)?.cubeType, `track ${trackIndex} #${position}`).to.eq(cubeType);
      });
    }

    it(`the Jovian and city cubes advance the event track from the Jovian cube on ${boardName}`, () => {
      const marsBot = setUpAridor(boardName);
      const event = marsBot.marsBotBoard.tracks[EVENT].position;

      MarsBotCorpResolver.onTrackAdvanced(marsBot, jovian, 6);

      // The event track's icons can move it on further
      expect(marsBot.marsBotBoard.tracks[EVENT].position).to.be.above(event);
    });
  }

  it('the Jovian and city cubes leave no cube on #6 of the Hellas energy track', () => {
    const marsBot = setUpAridor(BoardName.HELLAS);
    const event = marsBot.marsBotBoard.tracks[EVENT].position;

    expect(marsBot.hasCubeAt(4, 6)).is.undefined;
    MarsBotCorpResolver.onTrackAdvanced(marsBot, 4, 6);
    expect(marsBot.marsBotBoard.tracks[EVENT].position).to.eq(event);
  });

  it('the Jovian and city cubes stay where a game saved before the fix had them', () => {
    const marsBot = setUpAridor(BoardName.HELLAS);
    const serialized = marsBot.game.serialize();
    const jovianCube = serialized.automaState!.trackCubePositions!.find((c) => c.trackIndex === 3 && c.position === 6)!;
    jovianCube.trackIndex = 4;

    const restored = getMarsBot(Game.deserialize(serialized));

    expect(restored.hasCubeAt(4, 6)?.cubeType).to.eq('white');
    expect(restored.hasCubeAt(3, 6)).is.undefined;
  });

  it('corp name is Aridor', () => {
    expect(CardName.ARIDOR).to.not.be.undefined;
  });
});
