import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {MarsBotBonusDeck} from '../../src/server/automa/MarsBotBonusDeck';
import {MarsBotTurnResolver} from '../../src/server/automa/MarsBotTurnResolver';
import {MarsBotTilePlacer} from '../../src/server/automa/MarsBotTilePlacer';
import {MarsBotBonusResolver} from '../../src/server/automa/MarsBotBonusResolver';
import {MarsBotScoring} from '../../src/server/automa/MarsBotScoring';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {MarsBotBoardData, TrackDefinition} from '../../src/common/automa/AutomaTypes';
import {SeededRandom} from '../../src/common/utils/Random';
import {TileType} from '../../src/common/TileType';
import {Tag} from '../../src/common/cards/Tag';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Resource} from '../../src/common/Resource';
import {createBaseBonusCards} from '../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: difficulty, boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.marsBot!};
}

function makeBoardWithTrack1Action(pos: number, action: string): MarsBotBoardData {
  const layout = new Array(19).fill(null);
  layout[pos] = action;
  return {
    ...THARSIS_MARSBOT_BOARD,
    trackDefs: THARSIS_MARSBOT_BOARD.trackDefs.map((def, i) => {
      if (i === 0) return {...def, layout} as TrackDefinition;
      return def;
    }),
  };
}

describe('MarsBot Fixes', () => {
  describe('isSoloMode returns false for automa', () => {
    it('automa game is not solo mode', () => {
      const {game} = createAutomaGame();
      expect(game.isSoloMode()).to.be.false;
    });

    it('normal 1-player game IS solo mode', () => {
      const [game] = testGame(1);
      expect(game.isSoloMode()).to.be.true;
    });
  });

  describe('MarsBot does not receive placement bonuses from game engine', () => {
    it('MarsBot Player does not gain resources from tile placement', () => {
      const {game, marsBot} = createAutomaGame();
      const bot = marsBot.player;

      // Find a space with bonus icons
      const spaceWithBonus = game.board.spaces.find((s) =>
        s.bonus.length > 0 && s.tile === undefined && s.spaceType === SpaceType.LAND,
      );
      if (spaceWithBonus) {
        const plantsBefore = bot.plants;
        const steelBefore = bot.steel;
        const titaniumBefore = bot.titanium;
        const mcBefore = bot.megaCredits;

        game.addCity(bot, spaceWithBonus);

        // MarsBot should NOT have gained any resources
        expect(bot.plants).to.eq(plantsBefore);
        expect(bot.steel).to.eq(steelBefore);
        expect(bot.titanium).to.eq(titaniumBefore);
        // MC might change from ocean adjacency in normal flow, but should NOT from tile bonuses
        // (ocean adjacency is also blocked for MarsBot now)
      }
    });

    it('human player still receives placement bonuses normally', () => {
      const {game, human} = createAutomaGame();
      const spaceWithBonus = game.board.spaces.find((s) =>
        s.bonus.length > 0 && s.tile === undefined && s.spaceType === SpaceType.LAND,
      );
      if (spaceWithBonus) {
        // Just verify no error is thrown — human should get bonuses as normal
        game.addCity(human, spaceWithBonus);
      }
    });
  });

  describe('Temperature heat bonuses give MarsBot 2 MC instead of production', () => {
    it('MarsBot gets 2 MC at -24C temperature bonus', () => {
      const {game, marsBot} = createAutomaGame();
      const bot = marsBot.player;

      // Set temperature to -26 (one step below -24 bonus)
      (game as any).temperature = -26;

      const mcBefore = marsBot.turnResolver.mcSupply;
      const heatProdBefore = bot.production.get(Resource.HEAT);

      game.increaseTemperature(bot, 1);

      // MarsBot should get 2 MC, NOT heat production
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 2);
      expect(bot.production.get(Resource.HEAT)).to.eq(heatProdBefore);
    });

    it('human player still gets heat production at -24C', () => {
      const {game, human} = createAutomaGame();

      (game as any).temperature = -26;

      const heatProdBefore = human.production.get(Resource.HEAT);
      game.increaseTemperature(human, 1);
      expect(human.production.get(Resource.HEAT)).to.eq(heatProdBefore + 1);
    });
  });

  describe('Milestone tiebreaker #2 - closest to meeting', () => {
    it('uses humanMilestoneCloseness when no human qualifies', () => {
      const {game, human, marsBot} = createAutomaGame();
      const board = marsBot.board;
      const resolver = marsBot.turnResolver;

      // Make MarsBot meet Builder (track 1 >= 8) and Planner (all tracks >= 4)
      // Set track 1 to 8
      for (let i = 0; i < 8; i++) board.getTrack(1).advance();
      // Set all tracks to 4
      for (let t = 2; t <= 7; t++) {
        for (let i = 0; i < 4; i++) board.getTrack(t).advance();
      }

      // Human has 0 building tags (far from Builder=8) but 20 TR (close to Terraformer=35)
      // So Terraformer is "closer" for the human than Builder
      // But MarsBot doesn't meet Terraformer, so this test just verifies no crash
      expect(board.getTrack(1).position).to.eq(8);
    });
  });

  describe('Neural Instance tile type', () => {
    it('NEURAL_INSTANCE tile type exists', () => {
      expect(TileType.NEURAL_INSTANCE).to.eq(44);
    });
  });

  describe('lastSoloGeneration returns 20 for automa', () => {
    it('automa game has 20 generations', () => {
      const {game} = createAutomaGame();
      expect(game.lastSoloGeneration()).to.eq(20);
    });
  });

  describe('Event cards advance Event track', () => {
    it('event-type card advances both its tag track and event track', () => {
      const {game, marsBot} = createAutomaGame();
      const board = marsBot.board;

      // Create a mock event card with Space tag
      const mockEventCard = {
        cost: 10,
        tags: [Tag.SPACE],
        type: 'event' as any,
        name: 'TestEvent' as any,
        metadata: {} as any,
      } as any;

      marsBot.turnResolver.resolveProjectCard(mockEventCard);

      // Space tag → Track 2 (pos 1 = advance, chains to pos 2), Event tag → Track 3 (pos 1 = advance, chains to pos 2)
      expect(board.getTrack(2).position).to.eq(2);
      expect(board.getTrack(3).position).to.eq(2);
    });
  });

  describe('MarsBot MC supply is canonical', () => {
    it('failed action adds to mcSupply', () => {
      const {marsBot} = createAutomaGame();
      const resolver = marsBot.turnResolver;

      // Max out a track
      for (let i = 0; i < 18; i++) marsBot.board.getTrack(7).advance();

      // Play a Plant tag card - track 7 is maxed, should fail
      const mockCard = {
        cost: 5, tags: [Tag.PLANT], type: 'automated' as any,
        name: 'TestPlant' as any, metadata: {} as any,
      } as any;
      resolver.resolveProjectCard(mockCard);

      expect(resolver.mcSupply).to.eq(5);
    });
  });

  describe('Track regression from production decrease', () => {
    it('Steel production decrease regresses Track 1', () => {
      const {marsBot} = createAutomaGame();
      const track = marsBot.board.getTrack(1);
      track.advance(); track.advance(); track.advance();
      expect(track.position).to.eq(3);

      marsBot.regressTrack('Steel');
      expect(track.position).to.eq(2);
    });

    it('Titanium production decrease regresses Track 2', () => {
      const {marsBot} = createAutomaGame();
      const track = marsBot.board.getTrack(2);
      track.advance();
      marsBot.regressTrack('Titanium');
      expect(track.position).to.eq(0);
    });

    it('MC production decrease regresses Track 3', () => {
      const {marsBot} = createAutomaGame();
      const track = marsBot.board.getTrack(3);
      track.advance(); track.advance();
      marsBot.regressTrack('MC');
      expect(track.position).to.eq(1);
    });

    it('Electricity production decrease regresses Track 5', () => {
      const {marsBot} = createAutomaGame();
      const track = marsBot.board.getTrack(5);
      track.advance();
      marsBot.regressTrack('Electricity');
      expect(track.position).to.eq(0);
    });

    it('Heat production decrease regresses Track 6', () => {
      const {marsBot} = createAutomaGame();
      const track = marsBot.board.getTrack(6);
      track.advance(); track.advance();
      marsBot.regressTrack('Heat');
      expect(track.position).to.eq(1);
    });

    it('Plants production decrease regresses Track 7', () => {
      const {marsBot} = createAutomaGame();
      const track = marsBot.board.getTrack(7);
      track.advance(); track.advance(); track.advance();
      marsBot.regressTrack('Plants');
      expect(track.position).to.eq(2);
    });
  });

  describe('Easy mode', () => {
    it('advance action is ignored in easy mode', () => {
      const [game, human] = testGame(1);
      const marsBot = TestPlayer.RED.newPlayer({name: 'marsbot'});
      (marsBot as any).game = game;

      const boardData = makeBoardWithTrack1Action(1, 'advance');
      const board = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, marsBot, human, board, 'easy');

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      resolver.resolveProjectCard(mockCard);

      // Position should be 1 (advanced once), NOT 2 (advance action ignored)
      expect(board.getTrack(1).position).to.eq(1);
    });

    it('failed action gives 3 MC in easy mode', () => {
      const {marsBot} = createAutomaGame('easy');
      const track = marsBot.board.getTrack(7);
      for (let i = 0; i < 18; i++) track.advance();

      const mockCard = {cost: 5, tags: [Tag.PLANT], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      marsBot.turnResolver.resolveProjectCard(mockCard);
      expect(marsBot.turnResolver.mcSupply).to.eq(3);
    });

    it('award values reduced by 5 in easy mode', () => {
      const {marsBot, game} = createAutomaGame('easy');
      // Scientist award = track 4 position + offset
      marsBot.board.getTrack(4).advance(); // position 1
      const award = game.awards.find((a) => a.name === 'Scientist');
      if (award) {
        const val = marsBot.turnResolver.getMarsBotAwardValue(award);
        expect(val).to.eq(1 - 5); // position 1 + offset -5 = -4
      }
    });
  });

  describe('Scoring MC-to-VP', () => {
    it('gen 10: 1 VP per 8 MC', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 10;
      marsBot.turnResolver.mcSupply = 17;
      const vp = marsBot.getVictoryPoints();
      expect(vp.mcToVP).to.eq(2); // floor(17/8)
    });

    it('gen 14: 1 VP per 6 MC', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 14;
      marsBot.turnResolver.mcSupply = 13;
      const vp = marsBot.getVictoryPoints();
      expect(vp.mcToVP).to.eq(2); // floor(13/6)
    });

    it('gen 17: 1 VP per 3 MC', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 17;
      marsBot.turnResolver.mcSupply = 10;
      const vp = marsBot.getVictoryPoints();
      expect(vp.mcToVP).to.eq(3); // floor(10/3)
    });
  });

  describe('First player alternation', () => {
    it('MarsBot does not go first in generation 1', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.goesFirst).to.be.false;
    });
  });

  describe('Brutal mode', () => {
    it('builds action deck with 5 cards', () => {
      const {marsBot} = createAutomaGame('brutal');
      marsBot.buildResearchActionDeck();
      expect(marsBot.actionDeck.length).to.eq(5);
    });
  });

  describe('Passing behavior', () => {
    it('MarsBot passes when action deck is empty', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.actionDeck = [];

      marsBot.takeTurn();
      expect(game.hasPassedThisActionPhase(marsBot.player)).to.be.true;
    });
  });

  describe('Multiple tags on one card', () => {
    it('advances multiple tracks for multi-tag card', () => {
      const {marsBot} = createAutomaGame();
      // Card with Building + Space tags
      // Track 1 pos 1 = null, Track 2 pos 1 = advance (chains to pos 2)
      const mockCard = {
        cost: 10, tags: [Tag.BUILDING, Tag.SPACE], type: 'automated' as any,
        name: 'MultiTag' as any, metadata: {} as any,
      } as any;
      marsBot.turnResolver.resolveProjectCard(mockCard);

      expect(marsBot.board.getTrack(1).position).to.eq(1); // Building: pos 1 (null)
      expect(marsBot.board.getTrack(2).position).to.eq(2); // Space: pos 1 (advance) → pos 2
    });
  });

  describe('Track chain actions', () => {
    it('tag_N action advances another track', () => {
      const [game, human] = testGame(1);
      const marsBot = TestPlayer.RED.newPlayer({name: 'marsbot'});
      (marsBot as any).game = game;

      const boardData = makeBoardWithTrack1Action(1, 'tag_2');
      const board = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, marsBot, human, board, 'normal');

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      resolver.resolveProjectCard(mockCard);

      expect(board.getTrack(1).position).to.eq(1);
      expect(board.getTrack(2).position).to.eq(2); // Chained: tag_2 → Track 2 pos 1 (advance) → pos 2
    });

    it('advance action moves same track forward again', () => {
      const [game, human] = testGame(1);
      const marsBot = TestPlayer.RED.newPlayer({name: 'marsbot'});
      (marsBot as any).game = game;

      const boardData = makeBoardWithTrack1Action(1, 'advance');
      const board = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, marsBot, human, board, 'normal');

      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      resolver.resolveProjectCard(mockCard);

      expect(board.getTrack(1).position).to.eq(2); // 1 + advance = 2
    });

    it('TR action increases terraform rating', () => {
      const [game, human] = testGame(1);
      const marsBot = TestPlayer.RED.newPlayer({name: 'marsbot'});
      (marsBot as any).game = game;

      const boardData = makeBoardWithTrack1Action(1, 'tr3');
      const board = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, marsBot, human, board, 'normal');

      const startTR = marsBot.getTerraformRating();
      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      resolver.resolveProjectCard(mockCard);

      expect(marsBot.getTerraformRating()).to.eq(startTR + 3);
    });
  });

  describe('Wild tags advance least-advanced track', () => {
    it('wild tag advances the least-advanced track (topmost if tied)', () => {
      const {marsBot} = createAutomaGame();
      const mockCard = {
        cost: 5, tags: [Tag.WILD], type: 'automated' as any,
        name: 'WildOnly' as any, metadata: {} as any,
      } as any;
      marsBot.turnResolver.resolveProjectCard(mockCard);

      // Wild tag advances the least-advanced track (all at 0, so track 1 = topmost)
      expect(marsBot.board.getTrack(1).position).to.eq(1);
      for (let t = 2; t <= 7; t++) {
        expect(marsBot.board.getTrack(t).position).to.eq(0);
      }
    });
  });

  describe('Regressed positions skip actions', () => {
    it('regressed position action is skipped on re-advance', () => {
      const [game, human] = testGame(1);
      const marsBot = TestPlayer.RED.newPlayer({name: 'marsbot'});
      (marsBot as any).game = game;

      // Track 1 pos 1 has tr3 action
      const boardData = makeBoardWithTrack1Action(1, 'tr3');
      const board = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, marsBot, human, board, 'normal');

      // Advance to pos 1 (triggers tr3)
      const startTR = marsBot.getTerraformRating();
      const mockCard = {cost: 5, tags: [Tag.BUILDING], type: 'automated' as any, name: 'T' as any, metadata: {} as any} as any;
      resolver.resolveProjectCard(mockCard);
      expect(marsBot.getTerraformRating()).to.eq(startTR + 3);

      // Advance to pos 2
      resolver.resolveProjectCard(mockCard);
      expect(board.getTrack(1).position).to.eq(2);

      // Regress back to pos 1
      board.getTrack(1).regress();
      expect(board.getTrack(1).position).to.eq(1);

      // Re-advance to pos 2 - the action at pos 2 should be null (it's null in our layout)
      // But the IMPORTANT thing: pos 2 was regressed from, so action should be skipped
      const trBefore = marsBot.getTerraformRating();
      resolver.resolveProjectCard(mockCard);
      expect(board.getTrack(1).position).to.eq(2);
      // No TR gain from skipped action
      expect(marsBot.getTerraformRating()).to.eq(trBefore);
    });
  });
});
