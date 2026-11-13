import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Tag} from '../../src/common/cards/Tag';
import {BoardName} from '../../src/common/boards/BoardName';
import {MARSBOT_BOARD_NAMES, isMarsBotBoardChoice, modularMABlocksMarsBot} from '../../src/common/automa/MarsBotBoards';
import {MARSBOT_BOARDS} from '../../src/server/automa/boards/MarsBotBoards';
import {VENUS_MARSBOT_TRACK} from '../../src/server/automa/boards/VenusMarsBot';
import {AutomaGameHooks} from '../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {AutomaGameSetup} from '../../src/server/automa/AutomaGameSetup';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';

const MARS_TAGS = [Tag.BUILDING, Tag.SPACE, Tag.EVENT, Tag.SCIENCE, Tag.POWER, Tag.JOVIAN, Tag.EARTH, Tag.CITY, Tag.PLANT, Tag.ANIMAL, Tag.MICROBE];

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

function tracksOf(boardName: BoardName) {
  return MARSBOT_BOARDS[boardName]!;
}

describe('MarsBot boards', () => {
  for (const boardName of MARSBOT_BOARD_NAMES) {
    it('has a board for every supported map: ' + boardName, () => {
      expect(MARSBOT_BOARDS[boardName], boardName).is.not.undefined;
    });
  }

  for (const boardName of MARSBOT_BOARD_NAMES) {
    describe(boardName, () => {
      it('has 7 tracks of 19 spaces, empty start and a TR finish', () => {
        const tracks = tracksOf(boardName);
        expect(tracks).has.length(7);
        for (const track of tracks) {
          expect(track.layout).has.length(19);
          expect(track.layout[0]).is.undefined;
          expect(track.layout[18]).matches(/^tr\d$/);
        }
      });

      for (const tag of MARS_TAGS) {
        it('puts every Mars tag on exactly one track: ' + tag, () => {
          const tracks = tracksOf(boardName);
          expect(tracks.filter((t) => t.tags.includes(tag)), tag).has.length(1);
        });
      }

      it('keeps the Building, Space, Event, Science, Energy, Earth, Bio slot order', () => {
        const tracks = tracksOf(boardName);
        expect(tracks.map((t) => t.tags[0])).deep.eq([Tag.BUILDING, Tag.SPACE, Tag.EVENT, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.PLANT]);
      });

      it('only advances tracks that exist', () => {
        for (const track of tracksOf(boardName)) {
          for (const action of track.layout) {
            if (action?.startsWith('tag_')) {
              const tag = action.slice(4) as Tag;
              expect([...MARS_TAGS, Tag.VENUS], action).includes(tag);
            }
          }
        }
      });

      it('adds the Venus track with Venus Next', () => {
        expect(AutomaGameSetup.getBoardData(boardName, true)).deep.eq([...tracksOf(boardName), VENUS_MARSBOT_TRACK]);
      });

      it('sets up a game', () => {
        const [game] = testGame(1, {automa: true, boardName, venusNextExtension: true, coloniesExtension: true});
        const marsBot = getMarsBot(game);
        expect(marsBot.marsBotBoard.tracks).has.length(8);
      });
    });
  }

  // The six rulebook maps follow rulebook C, page 8. Amazonis Planitia is not in the rulebooks.
  for (const run of [
    // Tharsis and Utopia Planitia: Jovian with Energy, City with Earth, Microbe with Plant
    {boardName: BoardName.THARSIS, tag: Tag.JOVIAN, track: 4},
    {boardName: BoardName.THARSIS, tag: Tag.CITY, track: 5},
    {boardName: BoardName.THARSIS, tag: Tag.MICROBE, track: 6},
    {boardName: BoardName.UTOPIA_PLANITIA, tag: Tag.JOVIAN, track: 4},
    {boardName: BoardName.UTOPIA_PLANITIA, tag: Tag.CITY, track: 5},
    {boardName: BoardName.UTOPIA_PLANITIA, tag: Tag.MICROBE, track: 6},
    // Hellas and Elysium: Jovian with Science
    {boardName: BoardName.HELLAS, tag: Tag.JOVIAN, track: 3},
    {boardName: BoardName.HELLAS, tag: Tag.CITY, track: 5},
    {boardName: BoardName.ELYSIUM, tag: Tag.JOVIAN, track: 3},
    {boardName: BoardName.ELYSIUM, tag: Tag.CITY, track: 5},
    // Terra Cimmeria: Jovian with Earth, City with Science
    {boardName: BoardName.TERRA_CIMMERIA_NOVA, tag: Tag.JOVIAN, track: 5},
    {boardName: BoardName.TERRA_CIMMERIA_NOVA, tag: Tag.CITY, track: 3},
    // Vastitas Borealis: Microbe with Science, City with Energy, Jovian with Earth
    {boardName: BoardName.VASTITAS_BOREALIS_NOVA, tag: Tag.MICROBE, track: 3},
    {boardName: BoardName.VASTITAS_BOREALIS_NOVA, tag: Tag.CITY, track: 4},
    {boardName: BoardName.VASTITAS_BOREALIS_NOVA, tag: Tag.JOVIAN, track: 5},
    // Amazonis Planitia: Animal with Science
    {boardName: BoardName.AMAZONIS_PLANITIA, tag: Tag.ANIMAL, track: 3},
  ] as const) {
    it('pairs tags on each map: ' + JSON.stringify(run), () => {
      expect(tracksOf(run.boardName).findIndex((t) => t.tags.includes(run.tag))).eq(run.track);
    });
  }

  it('uses the Tharsis board with the Milestones & Awards expansion, whatever the map', () => {
    const [game] = testGame(1, {automa: true, boardName: BoardName.HELLAS, randomMA: RandomMAOptionType.UNLIMITED, modularMA: true});
    const marsBot = getMarsBot(game);
    expect(game.gameOptions.boardName).eq(BoardName.HELLAS);
    // Jovian sits on the Energy track on Tharsis, on the Science track on Hellas
    expect(marsBot.marsBotBoard.tagToTrack[Tag.JOVIAN]).eq(4);
  });

  it('Enceladus microbes advance the Science track on Vastitas Borealis', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.VASTITAS_BOREALIS_NOVA});
    const marsBot = getMarsBot(game);
    const science = marsBot.marsBotBoard.tracks[3];
    const bio = marsBot.marsBotBoard.tracks[6];
    const scienceBefore = science.position;
    const bioBefore = bio.position;

    marsBot.shippingBoard.add(ColonyName.ENCELADUS, 5, marsBot);

    expect(science.position).is.greaterThan(scienceBefore);
    expect(bio.position).eq(bioBefore);
  });

  for (const boardName of MARSBOT_BOARD_NAMES) {
    it('accepts a MarsBot map in the create form: ' + boardName, () => {
      expect(isMarsBotBoardChoice(boardName)).is.true;
    });
  }

  it('rejects the other maps in the create form', () => {
    expect(isMarsBotBoardChoice(BoardName.ARABIA_TERRA)).is.false;
    expect(isMarsBotBoardChoice(BoardName.VASTITAS_BOREALIS)).is.false;
  });

  it('keeps MarsBot off Amazonis Planitia while the Milestones & Awards expansion is in play', () => {
    for (const randomMA of [RandomMAOptionType.LIMITED, RandomMAOptionType.UNLIMITED, RandomMAOptionType.MANUAL]) {
      expect(modularMABlocksMarsBot(BoardName.AMAZONIS_PLANITIA, {modularMA: true, randomMA}), randomMA).is.true;
    }
    expect(modularMABlocksMarsBot(BoardName.AMAZONIS_PLANITIA, {modularMA: true, randomMA: RandomMAOptionType.NONE})).is.false;
    expect(modularMABlocksMarsBot(BoardName.AMAZONIS_PLANITIA, {modularMA: false, randomMA: RandomMAOptionType.LIMITED})).is.false;
  });

  it('plays Amazonis Planitia on its own board, with Animal on the Science track', () => {
    const [game] = testGame(1, {automa: true, boardName: BoardName.AMAZONIS_PLANITIA});
    const board = getMarsBot(game).marsBotBoard;

    expect(game.gameOptions.boardName).eq(BoardName.AMAZONIS_PLANITIA);
    expect(board.tracks[3].definition.tags).deep.eq([Tag.SCIENCE, Tag.ANIMAL]);
    expect(board.tracks[0].definition.layout[7]).eq('tag_science');
  });
});
