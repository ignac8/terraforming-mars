import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Tag} from '../../src/common/cards/Tag';
import {BoardName} from '../../src/common/boards/BoardName';
import {MARSBOT_BOARD_NAMES, isMarsBotBoardChoice} from '../../src/common/automa/MarsBotBoards';
import {MARSBOT_BOARDS} from '../../src/server/automa/boards/MarsBotBoards';
import {VENUS_MARSBOT_TRACK} from '../../src/server/automa/boards/VenusMarsBot';
import {AutomaGameHooks} from '../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {ColonyName} from '../../src/common/colonies/ColonyName';

const MARS_TAGS = [Tag.BUILDING, Tag.SPACE, Tag.EVENT, Tag.SCIENCE, Tag.POWER, Tag.JOVIAN, Tag.EARTH, Tag.CITY, Tag.PLANT, Tag.ANIMAL, Tag.MICROBE];

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

function tracksOf(boardName: BoardName) {
  return MARSBOT_BOARDS[boardName]!.base;
}

describe('MarsBot boards', () => {
  it('has a board for every supported map', () => {
    for (const boardName of MARSBOT_BOARD_NAMES) {
      expect(MARSBOT_BOARDS[boardName], boardName).is.not.undefined;
    }
  });

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

      it('puts every Mars tag on exactly one track', () => {
        const tracks = tracksOf(boardName);
        for (const tag of MARS_TAGS) {
          expect(tracks.filter((t) => t.tags.includes(tag)), tag).has.length(1);
        }
      });

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
        expect(MARSBOT_BOARDS[boardName]!.withVenus).deep.eq([...tracksOf(boardName), VENUS_MARSBOT_TRACK]);
      });

      it('sets up a game', () => {
        const [game] = testGame(1, {automaOption: true, boardName, venusNextExtension: true, coloniesExtension: true});
        const marsBot = getMarsBot(game);
        expect(marsBot.marsBotBoard.tracks).has.length(8);
      });
    });
  }

  it('pairs tags per rulebook C, page 8', () => {
    const trackOf = (boardName: BoardName, tag: Tag) => tracksOf(boardName).findIndex((t) => t.tags.includes(tag));
    // Tharsis and Utopia Planitia: Jovian with Energy, City with Earth, Microbe with Plant
    for (const boardName of [BoardName.THARSIS, BoardName.UTOPIA_PLANITIA]) {
      expect(trackOf(boardName, Tag.JOVIAN)).eq(4);
      expect(trackOf(boardName, Tag.CITY)).eq(5);
      expect(trackOf(boardName, Tag.MICROBE)).eq(6);
    }
    // Hellas and Elysium: Jovian with Science
    for (const boardName of [BoardName.HELLAS, BoardName.ELYSIUM]) {
      expect(trackOf(boardName, Tag.JOVIAN)).eq(3);
      expect(trackOf(boardName, Tag.CITY)).eq(5);
    }
    // Terra Cimmeria: Jovian with Earth, City with Science
    expect(trackOf(BoardName.TERRA_CIMMERIA_NOVA, Tag.JOVIAN)).eq(5);
    expect(trackOf(BoardName.TERRA_CIMMERIA_NOVA, Tag.CITY)).eq(3);
    // Vastitas Borealis: Microbe with Science, City with Energy, Jovian with Earth
    expect(trackOf(BoardName.VASTITAS_BOREALIS_NOVA, Tag.MICROBE)).eq(3);
    expect(trackOf(BoardName.VASTITAS_BOREALIS_NOVA, Tag.CITY)).eq(4);
    expect(trackOf(BoardName.VASTITAS_BOREALIS_NOVA, Tag.JOVIAN)).eq(5);
  });

  it('uses the Tharsis board with the Milestones & Awards expansion, whatever the map', () => {
    const [game] = testGame(1, {automaOption: true, boardName: BoardName.HELLAS, modularMA: true});
    const marsBot = getMarsBot(game);
    expect(game.gameOptions.boardName).eq(BoardName.HELLAS);
    // Jovian sits on the Energy track on Tharsis, on the Science track on Hellas
    expect(marsBot.marsBotBoard.tagToTrack[Tag.JOVIAN]).eq(4);
  });

  it('Enceladus microbes advance the Science track on Vastitas Borealis', () => {
    const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.VASTITAS_BOREALIS_NOVA});
    const marsBot = getMarsBot(game);
    const science = marsBot.marsBotBoard.tracks[3];
    const bio = marsBot.marsBotBoard.tracks[6];
    const scienceBefore = science.position;
    const bioBefore = bio.position;

    marsBot.shippingBoard.add(ColonyName.ENCELADUS, 5, marsBot);

    expect(science.position).is.greaterThan(scienceBefore);
    expect(bio.position).eq(bioBefore);
  });

  it('accepts only MarsBot maps in the create form', () => {
    for (const boardName of MARSBOT_BOARD_NAMES) {
      expect(isMarsBotBoardChoice(boardName)).is.true;
    }
    expect(isMarsBotBoardChoice(BoardName.ARABIA_TERRA)).is.false;
    expect(isMarsBotBoardChoice(BoardName.VASTITAS_BOREALIS)).is.false;
    // MarsBot is built for normal-size boards only
    expect(isMarsBotBoardChoice(BoardName.AMAZONIS_PLANITIA)).is.false;
  });
});
