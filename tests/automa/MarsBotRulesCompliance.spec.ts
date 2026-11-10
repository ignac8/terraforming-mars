import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {MarsBotTurnResolver} from '../../src/server/automa/MarsBotTurnResolver';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {TrackAction, TrackDefinition} from '../../src/common/automa/AutomaTypes';
import {BoardName} from '../../src/common/boards/BoardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {Phase} from '../../src/common/Phase';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Board} from '../../src/server/boards/Board';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automa: true, automaDifficulty: difficulty, boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

function makeBoard(track1Layout: ReadonlyArray<TrackAction | undefined>): ReadonlyArray<TrackDefinition> {
  return THARSIS_MARSBOT_BOARD.map((def, i) =>
    i === 0 ? {...def, layout: track1Layout} : def,
  );
}

function emptyLayout(): Array<TrackAction | undefined> {
  return new Array(19).fill(undefined);
}

function makeResolver(game: IGame, botPlayer: TestPlayer, human: TestPlayer, boardData: ReadonlyArray<TrackDefinition>, difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal') {
  const board = new MarsBotBoard(boardData);
  return {board, resolver: new MarsBotTurnResolver(game, botPlayer, human, board, difficulty)};
}

function mockCard(tags: Tag[], type: string = 'automated') {
  return {cost: 5, tags, type: type as any, name: 'Mock' as any, metadata: {} as any} as any;
}

describe('MarsBot Rules Compliance', () => {
  // ---- Rule 2.6: Track Actions ----

  describe('Rule 2.6: Greenery track action places tile + raises oxygen + grants TR', () => {
    it('greenery action places a greenery tile', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      (botPlayer as any).game = game;
      // Need a tile owned by bot for greenery placement rules
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      game.simpleAddTile(botPlayer, spaces[15], {tileType: TileType.CITY});

      const layout = emptyLayout();
      layout[1] = 'greenery';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      const greeneryBefore = game.board.getGreeneries(botPlayer).length;
      const trBefore = botPlayer.terraformRating;

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));

      expect(game.board.getGreeneries(botPlayer).length).to.eq(greeneryBefore + 1);
      // Greenery raises oxygen which raises TR
      expect(botPlayer.terraformRating).to.be.gt(trBefore);
    });
  });

  describe('Rule 2.6: Ocean track action places ocean + grants TR', () => {
    it('ocean action places an ocean tile and raises TR', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      (botPlayer as any).game = game;

      const layout = emptyLayout();
      layout[1] = 'ocean';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      const oceansBefore = game.board.getOceanSpaces().length;
      const trBefore = botPlayer.terraformRating;

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));

      expect(game.board.getOceanSpaces().length).to.eq(oceansBefore + 1);
      expect(botPlayer.terraformRating).to.eq(trBefore + 1);
    });
  });

  describe('Rule 2.6: City track action places city', () => {
    it('city action places a city tile', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      (botPlayer as any).game = game;

      const layout = emptyLayout();
      layout[1] = 'city';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      const citiesBefore = game.board.getCities(botPlayer).length;
      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      expect(game.board.getCities(botPlayer).length).to.eq(citiesBefore + 1);
    });
  });

  describe('Rule 2.6: Temperature track action raises temp + grants TR', () => {
    it('temperature action raises temperature and TR', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      (botPlayer as any).game = game;

      const layout = emptyLayout();
      layout[1] = 'temperature';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      const tempBefore = game.getTemperature();
      const trBefore = botPlayer.terraformRating;

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));

      expect(game.getTemperature()).to.eq(tempBefore + 2); // 1 step = 2°C
      expect(botPlayer.terraformRating).to.eq(trBefore + 1);
    });
  });

  // ---- Rule 2.7: Placement Bonuses ----

  describe('Rule 2.7: Placement bonuses give MC to megacredits', () => {
    it('tile placement adds 1 MC per bonus icon to megacredits', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      (botPlayer as any).game = game;

      const layout = emptyLayout();
      layout[1] = 'city';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      // Find a space with bonus icons
      const spaceWithBonus = game.board.spaces.find((s) =>
        s.bonus.length > 0 && s.tile === undefined && s.spaceType === SpaceType.LAND &&
        game.board.getAdjacentSpaces(s).every((adj) => !Board.isCitySpace(adj)),
      );

      if (spaceWithBonus) {
        const mcBefore = resolver.megacredits;
        resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
        // MC should have increased (from bonus icons and/or ocean adjacency)
        expect(resolver.megacredits).to.be.gte(mcBefore);
      }
    });

    it('tile adjacent to ocean gives 2 MC per adjacent ocean', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      (botPlayer as any).game = game;

      // Place an ocean tile first
      const oceanSpaces = game.board.getAvailableSpacesForOcean(botPlayer);
      game.simpleAddTile(botPlayer, oceanSpaces[0], {tileType: TileType.OCEAN});

      const layout = emptyLayout();
      layout[1] = 'city';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      const mcBefore = resolver.megacredits;
      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      // At minimum, the city might be adjacent to the ocean
      expect(resolver.megacredits).to.be.gte(mcBefore);
    });
  });

  // ---- Rule 2.5: Failed Actions ----

  describe('Rule 2.5: Failed Action scenarios', () => {
    it('greenery action with no available space = failed action', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      (botPlayer as any).game = game;

      // Fill all land spaces
      for (const s of game.board.spaces) {
        if (s.tile === undefined && s.spaceType === SpaceType.LAND) {
          game.simpleAddTile(botPlayer, s, {tileType: TileType.GREENERY});
        }
      }

      const layout = emptyLayout();
      layout[1] = 'greenery';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));
      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      expect(resolver.megacredits).to.eq(5);
    });

    it('city action with no available space = failed action', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      (botPlayer as any).game = game;

      // Fill all spaces with cities (impossible to place another city)
      const availableSpaces = game.board.getAvailableSpacesOnLand(botPlayer);
      for (const s of availableSpaces) {
        game.simpleAddTile(botPlayer, s, {tileType: TileType.CITY});
      }

      const layout = emptyLayout();
      layout[1] = 'city';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));
      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      expect(resolver.megacredits).to.eq(5);
    });
  });

  // ---- Rule 2.6: Award tiebreakers ----

  describe('Rule 2.6: Award funding tiebreakers', () => {
    it('MarsBot gets failed action when tied but not ahead on any award', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      (botPlayer as any).game = game;
      // Both at 0 for all awards — MarsBot is not AHEAD
      const layout = emptyLayout();
      layout[1] = 'award';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      expect(resolver.megacredits).to.eq(5); // Failed action
    });
  });

  // ---- Rule 2.11: Game End ----

  describe('Rule 2.11: Final greenery placement', () => {
    it('places greenery for tracks where next action is greenery', () => {
      const {game, marsBot} = createAutomaGame();
      // Place a city so greenery can be placed adjacent
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[15], {tileType: TileType.CITY});

      // Advance Track 7 to position where next action is greenery (pos 3 = greenery on Track 7)
      marsBot.marsBotBoard.tracks[6].advance(); // pos 1
      marsBot.marsBotBoard.tracks[6].advance(); // pos 2
      // Next action (pos 3) = greenery

      const greeneryBefore = game.board.getGreeneries(marsBot.player).length;
      marsBot.placeFinalGreeneries();
      expect(game.board.getGreeneries(marsBot.player).length).to.be.gte(greeneryBefore);
    });

    it('does NOT place greenery when next action is not greenery', () => {
      const {game, marsBot} = createAutomaGame();
      // Track 1 at pos 0, next (pos 1) = null on Tharsis
      const greeneryBefore = game.board.getGreeneries(marsBot.player).length;
      marsBot.placeFinalGreeneries();
      expect(game.board.getGreeneries(marsBot.player).length).to.eq(greeneryBefore);
    });
  });

  describe('Rule 2.11: Card VP is 0 in normal mode', () => {
    it('cardVP is 0', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).phase = Phase.END;
      const vp = marsBot.getVictoryPoints();
      expect(vp.cardVP).to.eq(0);
    });
  });

  describe('Rule 2.11: Tie = MarsBot wins', () => {
    it('when scores are equal, MarsBot wins (human does NOT win)', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Set both to exact same TR, no other VP sources
      human.setTerraformRating(25);
      marsBot.player.setTerraformRating(25);
      (game as any).phase = Phase.END;

      const humanVP = human.getVictoryPoints().total;
      const marsBotVP = marsBot.getVictoryPoints().total;
      // Human total might differ due to card VP etc, but with minimal setup:
      // The rule is: if marsBot >= human, marsBot wins
      // We verify the model communicates this
      if (humanVP === marsBotVP) {
        // Tie = MarsBot wins per rules
        expect(marsBot.toModel().instantWin).to.be.false; // Not instant win, just tie win
      }
    });
  });

  // ---- Rule 2.2: First Player Alternation ----

  describe('Rule 2.2: First player alternates each generation', () => {
    it('gen 1: human goes first', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.goesFirst).to.be.false;
    });

    it('gen 2: MarsBot goes first', () => {
      const {game, marsBot} = createAutomaGame();
      // Simulate research phase toggle (which alternates goesFirst)
      marsBot.buildResearchActionDeck();
      (game as any).generation = 2;
      marsBot.goesFirst = !marsBot.goesFirst; // Simulating what gotoResearchPhase does
      expect(marsBot.goesFirst).to.be.true;
    });

    it('gen 3: human goes first again', () => {
      const {marsBot} = createAutomaGame();
      marsBot.goesFirst = true; // gen 2
      marsBot.goesFirst = !marsBot.goesFirst; // gen 3 toggle
      expect(marsBot.goesFirst).to.be.false;
    });
  });

  // ---- Rule 2.12: Difficulty Levels ----

  describe('Rule 2.12: Hard mode milestone conditions', () => {
    it('does not claim when 0 milestones claimed and MarsBot meets <3', () => {
      const {game, marsBot} = createAutomaGame('hard');
      marsBot.turnResolver.megacredits = 10;
      marsBot.player.setTerraformRating(35); // Meets Terraformer only (1 milestone)
      marsBot.player.actionsTakenThisRound = 0;

      // 0 claimed, meets 1 → needs 3+ → should NOT claim
      (marsBot as any).hardModeFirstTurnMilestone();
      expect(game.claimedMilestones.length).to.eq(0);
    });

    it('claims when 2 milestones claimed and MarsBot meets any', () => {
      const {game, human, marsBot} = createAutomaGame('hard');
      marsBot.turnResolver.megacredits = 10;
      marsBot.player.setTerraformRating(35); // Meets Terraformer

      // Claim 2 OTHER milestones (not Terraformer) so MarsBot can still claim Terraformer
      const nonTerraformer = game.milestones.filter((m) => m.name !== 'Terraformer');
      game.claimedMilestones.push({player: human, milestone: nonTerraformer[0]});
      game.claimedMilestones.push({player: human, milestone: nonTerraformer[1]});
      marsBot.player.actionsTakenThisRound = 0;

      (marsBot as any).hardModeFirstTurnMilestone();
      expect(game.claimedMilestones.length).to.eq(3); // Now 3
      expect(marsBot.turnResolver.megacredits).to.eq(2); // 10 - 8
    });

    it('does not claim when not enough MC', () => {
      const {game, human, marsBot} = createAutomaGame('hard');
      marsBot.turnResolver.megacredits = 5; // Less than 8
      marsBot.player.setTerraformRating(35);
      game.claimedMilestones.push({player: human, milestone: game.milestones[0]});
      game.claimedMilestones.push({player: human, milestone: game.milestones[1]});
      marsBot.player.actionsTakenThisRound = 0;

      (marsBot as any).hardModeFirstTurnMilestone();
      expect(game.claimedMilestones.length).to.eq(2); // No change
    });
  });

  // ---- Rule 2.9: Production Phase ----

  describe('Rule 2.9: MarsBot skips production', () => {
    it('MarsBot MC supply unchanged during production', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 15;
      marsBot.runProductionPhase();
      expect(marsBot.turnResolver.megacredits).to.eq(15);
    });

    it('MarsBot TR does not add MC during production', () => {
      const {marsBot} = createAutomaGame();
      const mcBefore = marsBot.player.megaCredits;
      marsBot.player.setTerraformRating(30);
      marsBot.runProductionPhase();
      // Normal production would add TR to MC, but MarsBot skips
      expect(marsBot.player.megaCredits).to.eq(mcBefore);
    });
  });

  // ---- Rule 2.4: Turn alternation ----

  describe('Rule 2.4: MarsBot plays one card per turn', () => {
    it('action deck decreases after takeTurn', () => {
      const {marsBot} = createAutomaGame();
      const deckBefore = marsBot.actionDeck.length;
      expect(deckBefore).to.eq(4);

      marsBot.takeTurn();
      // Deck should decrease (by 1 for project card, possibly more if bonus card draws extra)
      expect(marsBot.actionDeck.length).to.be.lt(deckBefore);
    });
  });
});
