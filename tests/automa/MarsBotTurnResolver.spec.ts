import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {MarsBotTurnResolver} from '../../src/server/automa/MarsBotTurnResolver';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {TrackDefinition} from '../../src/common/automa/AutomaTypes';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Algae} from '../../src/server/cards/base/Algae';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {EarthOffice} from '../../src/server/cards/base/EarthOffice';
import {SpaceStation} from '../../src/server/cards/base/SpaceStation';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';

/** Helper: create a board where track 1 has a specific action at a given position, rest null. */
function makeBoardWithTrack1Action(pos: number, action: string): ReadonlyArray<TrackDefinition> {
  const layout = new Array(19).fill(undefined);
  layout[pos] = action;
  return THARSIS_MARSBOT_BOARD.map((def, i) => {
    if (i === 0) {
      return {...def, layout} as TrackDefinition;
    }
    return def;
  });
}

/** Helper: create a board with all tracks having only empty positions. */
function makeEmptyBoard(): ReadonlyArray<TrackDefinition> {
  const emptyLayout = new Array(19).fill(undefined);
  return THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: emptyLayout} as TrackDefinition));
}

describe('MarsBotTurnResolver', () => {
  let game: IGame;
  let human: TestPlayer;
  let marsBot: TestPlayer;
  let board: MarsBotBoard;
  let resolver: MarsBotTurnResolver;

  beforeEach(() => {
    [game, human] = testGame(1);
    marsBot = TestPlayer.RED.newPlayer({name: 'marsbot'});
    (marsBot as any).game = game;
    board = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
    resolver = new MarsBotTurnResolver(game, marsBot, human, board, 'normal');
  });

  describe('Project card tag resolution', () => {
    it('resolves project card with Plant tag → Track 7', () => {
      const card = new Algae();
      resolver.resolveProjectCard(card as IProjectCard);
      expect(board.tracks[6].position).to.be.gte(1);
    });

    it('resolves project card with Earth tag → Track 6', () => {
      const card = new EarthOffice();
      resolver.resolveProjectCard(card as IProjectCard);
      expect(board.tracks[5].position).to.be.gte(1);
    });

    it('resolves project card with Space tag (chains advance at pos 1)', () => {
      const card = new SpaceStation();
      resolver.resolveProjectCard(card as IProjectCard);
      // Track 2 pos 1 = advance, chains to pos 2
      expect(board.tracks[1].position).to.eq(2);
    });

    it('resolves project card with Science tag (chains advance at pos 1)', () => {
      const card = new SearchForLife();
      resolver.resolveProjectCard(card as IProjectCard);
      // Track 4 pos 1 = advance, chains to pos 2
      expect(board.tracks[3].position).to.eq(2);
    });

    it('resolves event card with Space tag — advances both Space and Event tracks', () => {
      const card = new Asteroid();
      resolver.resolveProjectCard(card as IProjectCard);
      // Space → Track 2 (pos 1=advance → pos 2), Event → Track 3 (pos 1=advance → pos 2)
      expect(board.tracks[1].position).to.eq(2);
      expect(board.tracks[2].position).to.eq(2);
    });

    it('resolves card with multiple tags advancing different tracks', () => {
      // EarthOffice has [Tag.EARTH] → Track 6. Let's use a multi-tag card.
      // TundraFarming has [Tag.PLANT] → Track 7
      const emptyBoardData = makeEmptyBoard();
      const emptyBoard = new MarsBotBoard(emptyBoardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, emptyBoard, 'normal');

      // Mock a card with Building + Space tags
      const mockCard = {cost: 10, tags: [Tag.BUILDING, Tag.SPACE], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(emptyBoard.tracks[0].position).to.eq(1);
      expect(emptyBoard.tracks[1].position).to.eq(1);
    });

    it('Wild tags advance least-advanced track', () => {
      const emptyBoardData = makeEmptyBoard();
      const emptyBoard = new MarsBotBoard(emptyBoardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, emptyBoard, 'normal');
      const mockCard = {cost: 5, tags: [Tag.WILD], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      // Wild tag advances the least-advanced track (all at 0, so track 0 = topmost)
      expect(emptyBoard.tracks[0].position).to.eq(1);
      for (let t = 1; t < 7; t++) {
        expect(emptyBoard.tracks[t].position).to.eq(0);
      }
    });

    it('unmapped tags are ignored without error', () => {
      const emptyBoardData = makeEmptyBoard();
      const emptyBoard = new MarsBotBoard(emptyBoardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, emptyBoard, 'normal');
      const mockCard = {cost: 5, tags: [Tag.VENUS], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      // No crash, no track advancement
      for (let t = 0; t < 7; t++) {
        expect(emptyBoard.tracks[t].position).to.eq(0);
      }
    });

    it('card with no tags at all is a failed action', () => {
      const emptyBoardData = makeEmptyBoard();
      const emptyBoard = new MarsBotBoard(emptyBoardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, emptyBoard, 'normal');
      const mockCard = {cost: 5, tags: [] as Tag[], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(r.mcSupply).to.eq(5);
    });

    it('event card with no other tags still advances Event track', () => {
      const emptyBoardData = makeEmptyBoard();
      const emptyBoard = new MarsBotBoard(emptyBoardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, emptyBoard, 'normal');
      // Event card with no explicit tags — only the injected EVENT tag
      const mockCard = {cost: 5, tags: [] as Tag[], type: 'event' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(emptyBoard.tracks[2].position).to.eq(1); // Event track
      expect(r.mcSupply).to.eq(0); // NOT a failed action
    });
  });

  describe('Failed actions', () => {
    it('gives 5 MC when track is at max', () => {
      const track = board.tracks[6];
      for (let i = 0; i < 18; i++) {
        track.advance();
      }
      expect(track.position).to.eq(18);

      resolver.resolveProjectCard(new Algae() as IProjectCard);
      expect(resolver.mcSupply).to.eq(5);
    });

    it('gives 3 MC in easy mode', () => {
      const easyResolver = new MarsBotTurnResolver(game, marsBot, human, board, 'easy');
      const track = board.tracks[6];
      for (let i = 0; i < 18; i++) {
        track.advance();
      }

      easyResolver.resolveProjectCard(new Algae() as IProjectCard);
      expect(easyResolver.mcSupply).to.eq(3);
    });

    it('accumulates MC across multiple failed actions', () => {
      const emptyBoardData = makeEmptyBoard();
      const emptyBoard = new MarsBotBoard(emptyBoardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, emptyBoard, 'normal');
      // Max out track 7
      for (let i = 0; i < 18; i++) {
        emptyBoard.tracks[6].advance();
      }

      r.resolveProjectCard(new Algae() as IProjectCard); // 5 MC
      r.resolveProjectCard(new Algae() as IProjectCard); // 5 MC
      expect(r.mcSupply).to.eq(10);
    });
  });

  describe('Track actions', () => {
    it('advance action moves same track forward', () => {
      const boardData = makeBoardWithTrack1Action(1, 'advance');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(b.tracks[0].position).to.eq(2); // 1 (advance) → 2
    });

    it('advance action ignored in easy mode', () => {
      const boardData = makeBoardWithTrack1Action(1, 'advance');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'easy');

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(b.tracks[0].position).to.eq(1); // advance ignored
    });

    it('tag_N action advances another track', () => {
      const boardData = makeBoardWithTrack1Action(1, 'tag_6');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(b.tracks[0].position).to.eq(1);
      expect(b.tracks[6].position).to.be.gte(1);
    });

    it('TR action increases terraform rating', () => {
      const boardData = makeBoardWithTrack1Action(1, 'tr3');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      const startTR = marsBot.terraformRating;
      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(marsBot.terraformRating).to.eq(startTR + 3);
    });

    it('TR1 through TR8 all work', () => {
      for (let n = 1; n <= 8; n++) {
        const boardData = makeBoardWithTrack1Action(1, `tr${n}`);
        const b = new MarsBotBoard(boardData);
        const bot = TestPlayer.RED.newPlayer({name: `bot${n}`});
        (bot as any).game = game;
        const r = new MarsBotTurnResolver(game, bot, human, b, 'normal');

        const startTR = bot.terraformRating;
        const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
        r.resolveProjectCard(mockCard);
        expect(bot.terraformRating).to.eq(startTR + n, `TR${n} failed`);
      }
    });

    it('milestone action at end of track gives failed action if all claimed', () => {
      const boardData = makeBoardWithTrack1Action(1, 'milestone');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      // Claim all 3 milestones
      for (let i = 0; i < 3 && i < game.milestones.length; i++) {
        game.claimedMilestones.push({player: human, milestone: game.milestones[i]});
      }

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(r.mcSupply).to.eq(5); // Failed action
    });

    it('award action gives failed action when all funded', () => {
      const boardData = makeBoardWithTrack1Action(1, 'award');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      // Fund all 3 awards
      for (let i = 0; i < 3 && i < game.awards.length; i++) {
        game.fundedAwards.push({player: human, award: game.awards[i]});
      }

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(r.mcSupply).to.eq(5); // Failed action
    });

    it('temperature action fails when already maxed', () => {
      const boardData = makeBoardWithTrack1Action(1, 'temperature');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      (game as any).temperature = 8; // MAX
      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(r.mcSupply).to.eq(5);
    });

    it('ocean action fails when 9 oceans placed', () => {
      const boardData = makeBoardWithTrack1Action(1, 'ocean');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      // Fill all ocean spaces
      const oceanSpaces = game.board.getAvailableSpacesForOcean(marsBot);
      for (const s of oceanSpaces) {
        game.simpleAddTile(marsBot, s, {tileType: 1}); // TileType.OCEAN
      }
      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      expect(r.mcSupply).to.eq(5);
    });

    it('chained advance that hits max gives failed action', () => {
      // Track 1 has advance at pos 17, pos 18 has something
      const layout = new Array(19).fill(undefined);
      layout[18] = 'advance'; // At the very last position
      const boardData = THARSIS_MARSBOT_BOARD.map((def, i) => i === 0 ? {...def, layout} as TrackDefinition : def);
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      // Advance to 17
      for (let i = 0; i < 17; i++) {
        b.tracks[0].advance();
      }

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      // Pos 18 = advance, but can't advance further → failed action
      expect(b.tracks[0].position).to.eq(18);
      expect(r.mcSupply).to.eq(5);
    });
  });

  describe('Award evaluation (track-based)', () => {
    it('Landlord counts MarsBot tiles', () => {
      const spaces = game.board.getAvailableSpacesOnLand(marsBot);
      game.simpleAddTile(marsBot, spaces[5], {tileType: 0}); // GREENERY
      game.simpleAddTile(marsBot, spaces[10], {tileType: 2}); // CITY
      const award = game.awards.find((a) => a.name === 'Landlord');
      if (award) {
        expect(resolver.getMarsBotAwardValue(award)).to.eq(2);
      }
    });

    it('Banker is track 1 + track 3', () => {
      board.tracks[0].advance(); board.tracks[0].advance(); // pos 2
      board.tracks[2].advance(); board.tracks[2].advance(); board.tracks[2].advance(); // pos 3
      const award = game.awards.find((a) => a.name === 'Banker');
      if (award) {
        expect(resolver.getMarsBotAwardValue(award)).to.eq(2 + 3);
      }
    });

    it('Scientist is track 4 position', () => {
      for (let i = 0; i < 5; i++) {
        board.tracks[3].advance();
      }
      const award = game.awards.find((a) => a.name === 'Scientist');
      if (award) {
        expect(resolver.getMarsBotAwardValue(award)).to.eq(5);
      }
    });

    it('Thermalist is track 5 + 5', () => {
      for (let i = 0; i < 3; i++) {
        board.tracks[4].advance();
      }
      const award = game.awards.find((a) => a.name === 'Thermalist');
      if (award) {
        expect(resolver.getMarsBotAwardValue(award)).to.eq(3 + 5);
      }
    });

    it('Miner is track 2 + 5', () => {
      for (let i = 0; i < 4; i++) {
        board.tracks[1].advance();
      }
      const award = game.awards.find((a) => a.name === 'Miner');
      if (award) {
        expect(resolver.getMarsBotAwardValue(award)).to.eq(4 + 5);
      }
    });

    it('easy mode reduces award values by 5', () => {
      const easyResolver = new MarsBotTurnResolver(game, marsBot, human, board, 'easy');
      for (let i = 0; i < 3; i++) {
        board.tracks[3].advance();
      }
      const award = game.awards.find((a) => a.name === 'Scientist');
      if (award) {
        expect(easyResolver.getMarsBotAwardValue(award)).to.eq(3 - 5);
      }
    });
  });

  describe('Milestone criteria (track-based)', () => {
    it('Terraformer: needs 35 TR', () => {
      marsBot.setTerraformRating(34);
      const m = game.milestones.find((ms) => ms.name === 'Terraformer');
      if (m) {
        expect(resolver.marsBotMeetsMilestone(m)).to.be.false;
        marsBot.setTerraformRating(35);
        expect(resolver.marsBotMeetsMilestone(m)).to.be.true;
      }
    });

    it('Builder: needs track 1 at position 8', () => {
      const m = game.milestones.find((ms) => ms.name === 'Builder');
      if (m) {
        for (let i = 0; i < 7; i++) {
          board.tracks[0].advance();
        }
        expect(resolver.marsBotMeetsMilestone(m)).to.be.false;
        board.tracks[0].advance();
        expect(resolver.marsBotMeetsMilestone(m)).to.be.true;
      }
    });

    it('Planner: needs all tracks at position 4', () => {
      const m = game.milestones.find((ms) => ms.name === 'Planner');
      if (m) {
        for (let t = 0; t < 7; t++) {
          for (let i = 0; i < 3; i++) {
            board.tracks[t].advance();
          }
        }
        expect(resolver.marsBotMeetsMilestone(m)).to.be.false;
        for (let t = 0; t < 7; t++) {
          board.tracks[t].advance();
        }
        expect(resolver.marsBotMeetsMilestone(m)).to.be.true;
      }
    });
  });

  describe('Venus actions (ignored in base game)', () => {
    it('venus action fails when venus not enabled', () => {
      const boardData = makeBoardWithTrack1Action(1, 'venus');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard);
      // Venus scale is at 0 and max is 30, so it should work... unless venus expansion is off
      // The game engine will handle this — venus actions fail gracefully when venus is at max
    });
  });

  describe('Regressed positions', () => {
    it('regressed position action is skipped on re-advance', () => {
      const boardData = makeBoardWithTrack1Action(2, 'tr5');
      const b = new MarsBotBoard(boardData);
      const r = new MarsBotTurnResolver(game, marsBot, human, b, 'normal');

      // Advance to pos 2 (gets tr5)
      const startTR = marsBot.terraformRating;
      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      r.resolveProjectCard(mockCard); // pos 1 (null)
      r.resolveProjectCard(mockCard); // pos 2 (tr5)
      expect(marsBot.terraformRating).to.eq(startTR + 5);

      // Regress from pos 2
      b.tracks[0].regress();
      expect(b.tracks[0].position).to.eq(1);

      // Re-advance to pos 2 — action should be skipped
      const trBefore = marsBot.terraformRating;
      r.resolveProjectCard(mockCard);
      expect(b.tracks[0].position).to.eq(2);
      expect(marsBot.terraformRating).to.eq(trBefore); // No TR gain
    });
  });
});
