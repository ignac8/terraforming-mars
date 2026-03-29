import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {Tag} from '../../src/common/cards/Tag';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: 'normal', boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.marsBot!};
}

describe('MarsBotTags', () => {
  describe('Tag counting uses track positions', () => {
    it('Building tag returns Track 1 position', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance(); // pos 1
      marsBot.board.tracks[0].advance(); // pos 2
      marsBot.board.tracks[0].advance(); // pos 3
      expect(marsBot.player.tags.count(Tag.BUILDING, 'raw')).to.eq(3);
    });

    it('Space tag returns Track 2 position', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 5; i++) { marsBot.board.tracks[1].advance(); }
      expect(marsBot.player.tags.count(Tag.SPACE, 'raw')).to.eq(5);
    });

    it('Event tag returns Track 3 position', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 7; i++) { marsBot.board.tracks[2].advance(); }
      expect(marsBot.player.tags.count(Tag.EVENT, 'raw')).to.eq(7);
    });

    it('Science tag returns Track 4 position', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 4; i++) { marsBot.board.tracks[3].advance(); }
      expect(marsBot.player.tags.count(Tag.SCIENCE, 'raw')).to.eq(4);
    });

    it('Power/Energy tag returns Track 5 position', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 6; i++) { marsBot.board.tracks[4].advance(); }
      expect(marsBot.player.tags.count(Tag.POWER, 'raw')).to.eq(6);
    });

    it('Jovian tag also returns Track 5 position (shared track)', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 6; i++) { marsBot.board.tracks[4].advance(); }
      expect(marsBot.player.tags.count(Tag.JOVIAN, 'raw')).to.eq(6);
    });

    it('Earth tag returns Track 6 position', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 2; i++) { marsBot.board.tracks[5].advance(); }
      expect(marsBot.player.tags.count(Tag.EARTH, 'raw')).to.eq(2);
    });

    it('City tag also returns Track 6 position (shared track)', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 2; i++) { marsBot.board.tracks[5].advance(); }
      expect(marsBot.player.tags.count(Tag.CITY, 'raw')).to.eq(2);
    });

    it('Plant tag returns Track 7 position', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 8; i++) { marsBot.board.tracks[6].advance(); }
      expect(marsBot.player.tags.count(Tag.PLANT, 'raw')).to.eq(8);
    });

    it('Animal tag also returns Track 7 position (shared track)', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 8; i++) { marsBot.board.tracks[6].advance(); }
      expect(marsBot.player.tags.count(Tag.ANIMAL, 'raw')).to.eq(8);
    });

    it('Microbe tag also returns Track 7 position (shared track)', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 8; i++) { marsBot.board.tracks[6].advance(); }
      expect(marsBot.player.tags.count(Tag.MICROBE, 'raw')).to.eq(8);
    });
  });

  describe('Unmapped tags return 0', () => {
    it('Venus tag returns 0', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.tags.count(Tag.VENUS, 'raw')).to.eq(0);
    });

    it('Moon tag returns 0', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.tags.count(Tag.MOON, 'raw')).to.eq(0);
    });

    it('Wild tag returns 0', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.tags.count(Tag.WILD, 'raw')).to.eq(0);
    });

    it('Mars tag returns 0', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.tags.count(Tag.MARS, 'raw')).to.eq(0);
    });
  });

  describe('Track position changes are reflected immediately', () => {
    it('advancing a track updates the tag count', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.tags.count(Tag.BUILDING, 'raw')).to.eq(0);
      marsBot.board.tracks[0].advance();
      expect(marsBot.player.tags.count(Tag.BUILDING, 'raw')).to.eq(1);
      marsBot.board.tracks[0].advance();
      expect(marsBot.player.tags.count(Tag.BUILDING, 'raw')).to.eq(2);
    });

    it('regressing a track updates the tag count', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      expect(marsBot.player.tags.count(Tag.BUILDING, 'raw')).to.eq(3);
      marsBot.board.tracks[0].regress();
      expect(marsBot.player.tags.count(Tag.BUILDING, 'raw')).to.eq(2);
    });
  });

  describe('countAllTags uses track positions', () => {
    it('returns track positions for all mapped tags', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 3; i++) { marsBot.board.tracks[0].advance(); }
      for (let i = 0; i < 5; i++) { marsBot.board.tracks[1].advance(); }
      for (let i = 0; i < 2; i++) { marsBot.board.tracks[2].advance(); }

      const allTags = marsBot.player.tags.countAllTags();
      expect(allTags[Tag.BUILDING]).to.eq(3);
      expect(allTags[Tag.SPACE]).to.eq(5);
      expect(allTags[Tag.EVENT]).to.eq(2);
    });

    it('Event tag in countAllTags comes from track, not playedCards', () => {
      const {marsBot} = createAutomaGame();
      // MarsBot has 0 played event cards but Track 3 at position 4
      for (let i = 0; i < 4; i++) { marsBot.board.tracks[2].advance(); }

      const allTags = marsBot.player.tags.countAllTags();
      expect(allTags[Tag.EVENT]).to.eq(4);
    });
  });

  describe('Human player querying MarsBot tags (Toll Station scenario)', () => {
    it('opponent Space tags count uses MarsBot Track 2 position', () => {
      const {marsBot} = createAutomaGame();
      // Advance Track 2 (Space) to position 5
      for (let i = 0; i < 5; i++) { marsBot.board.tracks[1].advance(); }

      // This simulates what Toll Station does: count opponent's Space tags
      const opponentSpaceTags = marsBot.player.tags.count(Tag.SPACE, 'raw');
      expect(opponentSpaceTags).to.eq(5);
    });

    it('Galilean Waystation scenario: opponent Jovian tags', () => {
      const {marsBot} = createAutomaGame();
      // Track 5 (Energy/Jovian) at position 8
      for (let i = 0; i < 8; i++) { marsBot.board.tracks[4].advance(); }

      // Galilean Waystation counts opponent's Jovian tags (but halved and rounded down)
      const opponentJovianTags = marsBot.player.tags.count(Tag.JOVIAN, 'raw');
      expect(opponentJovianTags).to.eq(8);
      // The card would use floor(8/2) = 4
    });
  });

  describe('default counting mode (includes wild)', () => {
    it('default mode still works (no wild tags for MarsBot)', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 3; i++) { marsBot.board.tracks[0].advance(); }
      // default mode adds wild tags, but MarsBot has 0 wild tags
      expect(marsBot.player.tags.count(Tag.BUILDING, 'default')).to.eq(3);
    });
  });
});
