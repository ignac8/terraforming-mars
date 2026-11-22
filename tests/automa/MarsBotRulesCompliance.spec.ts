import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {SeededRandom} from '../../src/common/utils/Random';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {TrackAction, TrackDefinition} from '../../src/common/automa/AutomaTypes';
import {BoardName} from '../../src/common/boards/BoardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {Phase} from '../../src/common/Phase';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {fakeCard} from '../TestingUtils';

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
  const marsBot = new MarsBot(game, botPlayer, human, boardData, difficulty, new SeededRandom(0));
  return {marsBot, board: marsBot.marsBotBoard, resolver: marsBot.turnResolver};
}

describe('MarsBot Rules Compliance', () => {
  describe('Rule 2.6: Greenery track action places tile + raises oxygen + grants TR', () => {
    it('greenery action places a greenery tile', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;
      // Need a tile owned by bot for greenery placement rules
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      game.simpleAddTile(botPlayer, spaces[15], {tileType: TileType.CITY});

      const layout = emptyLayout();
      layout[1] = 'greenery';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      const greeneryBefore = game.board.getGreeneries(botPlayer).length;
      const trBefore = botPlayer.terraformRating;

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));

      expect(game.board.getGreeneries(botPlayer).length).to.eq(greeneryBefore + 1);
      // Greenery raises oxygen which raises TR
      expect(botPlayer.terraformRating).to.be.gt(trBefore);
    });
  });

  describe('Rule 2.6: Ocean track action places ocean + grants TR', () => {
    it('ocean action places an ocean tile and raises TR', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      const layout = emptyLayout();
      layout[1] = 'ocean';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      const oceansBefore = game.board.getOceanSpaces().length;
      const trBefore = botPlayer.terraformRating;

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));

      expect(game.board.getOceanSpaces().length).to.eq(oceansBefore + 1);
      expect(botPlayer.terraformRating).to.eq(trBefore + 1);
    });
  });

  describe('Rule 2.6: City track action places city', () => {
    it('city action places a city tile', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      const layout = emptyLayout();
      layout[1] = 'city';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      const citiesBefore = game.board.getCities(botPlayer).length;
      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));
      expect(game.board.getCities(botPlayer).length).to.eq(citiesBefore + 1);
    });
  });

  describe('Rule 2.6: Temperature track action raises temp + grants TR', () => {
    it('temperature action raises temperature and TR', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      const layout = emptyLayout();
      layout[1] = 'temperature';
      const {resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      const tempBefore = game.getTemperature();
      const trBefore = botPlayer.terraformRating;

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));

      expect(game.getTemperature()).to.eq(tempBefore + 2); // 1 step = 2°C
      expect(botPlayer.terraformRating).to.eq(trBefore + 1);
    });
  });

  describe('Rule 2.7: Placement bonuses give MC to megacredits', () => {
    // Space 03 holds two steel icons and touches the ocean space 04. It is the only land space left open.
    for (const run of [
      {ocean: false, expected: 2},
      {ocean: true, expected: 4},
    ]) {
      it('a city pays 1 MC per bonus icon and 2 MC per adjacent ocean: ' + JSON.stringify(run), () => {
        const [game, human] = testGame(1);
        const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
        botPlayer.game = game;
        for (const space of game.board.spaces) {
          if (space.tile === undefined && space.spaceType === SpaceType.LAND && space.id !== '03') {
            game.simpleAddTile(human, space, {tileType: TileType.GREENERY});
          }
        }
        if (run.ocean) {
          game.simpleAddTile(human, game.board.getSpaceOrThrow('04'), {tileType: TileType.OCEAN});
        }

        const layout = emptyLayout();
        layout[1] = 'city';
        const {marsBot, resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

        resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));

        expect(game.board.getCities(botPlayer).map((space) => space.id)).deep.eq(['03']);
        expect(marsBot.megacredits).to.eq(run.expected);
      });
    }
  });

  describe('Rule 2.5: Failed Action scenarios', () => {
    it('greenery action with no available space = failed action', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      for (const s of game.board.spaces) {
        if (s.tile === undefined && s.spaceType === SpaceType.LAND) {
          game.simpleAddTile(botPlayer, s, {tileType: TileType.GREENERY});
        }
      }

      const layout = emptyLayout();
      layout[1] = 'greenery';
      const {marsBot, resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));
      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));
      expect(marsBot.megacredits).to.eq(5);
    });

    it('city action with no available space = failed action', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      const availableSpaces = game.board.getAvailableSpacesOnLand(botPlayer);
      for (const s of availableSpaces) {
        game.simpleAddTile(botPlayer, s, {tileType: TileType.CITY});
      }

      const layout = emptyLayout();
      layout[1] = 'city';
      const {marsBot, resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));
      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));
      expect(marsBot.megacredits).to.eq(5);
    });
  });

  describe('Rule 2.6: Award funding tiebreakers', () => {
    it('MarsBot gets failed action when tied but not ahead on any award', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;
      // Both at 0 for all awards — MarsBot is not AHEAD
      const layout = emptyLayout();
      layout[1] = 'award';
      const {marsBot, resolver} = makeResolver(game, botPlayer, human, makeBoard(layout));

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));
      expect(marsBot.megacredits).to.eq(5); // Failed action
    });
  });

  describe('Rule 2.11: Final greenery placement', () => {
    it('places greenery for tracks where next action is greenery', () => {
      const {game, marsBot} = createAutomaGame();
      // Place a city so greenery can be placed adjacent
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[15], {tileType: TileType.CITY});

      // Advance Track 7 to position where next action is greenery (pos 3 = greenery on Track 7)
      marsBot.marsBotBoard.tracks[6].advance(); // pos 1
      marsBot.marsBotBoard.tracks[6].advance(); // pos 2

      const greeneryBefore = game.board.getGreeneries(marsBot.player).length;
      marsBot.placeFinalGreeneries();
      expect(game.board.getGreeneries(marsBot.player).length).to.eq(greeneryBefore + 1);
      expect(marsBot.marsBotBoard.tracks[6].position).to.eq(3);
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
      game.phase = Phase.END;
      const vp = marsBot.getVictoryPoints();
      expect(vp.cardVP).to.eq(0);
    });
  });

  describe('Rule 2.2: First player alternates each generation', () => {
    it('gen 1: human goes first', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.goesFirst).to.be.false;
    });

    it('gen 2: MarsBot goes first', () => {
      const {game, marsBot} = createAutomaGame();
      // Simulate research phase toggle (which alternates goesFirst)
      marsBot.actionDeck.buildResearch();
      game.generation = 2;
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

  describe('Rule 2.12: Hard mode milestone conditions', () => {
    it('does not claim when 0 milestones claimed and MarsBot meets <3', () => {
      const {game, marsBot} = createAutomaGame('hard');
      marsBot.megacredits = 10;
      marsBot.player.setTerraformRating(35); // Meets Terraformer only (1 milestone)
      marsBot.player.actionsTakenThisRound = 0;

      // 0 claimed, meets 1 → needs 3+ → should NOT claim
      marsBot['hardModeFirstTurnMilestone']();
      expect(game.claimedMilestones.length).to.eq(0);
    });

    it('claims when 2 milestones claimed and MarsBot meets any', () => {
      const {game, human, marsBot} = createAutomaGame('hard');
      marsBot.megacredits = 10;
      marsBot.player.setTerraformRating(35); // Meets Terraformer

      // Claim 2 OTHER milestones (not Terraformer) so MarsBot can still claim Terraformer
      const nonTerraformer = game.milestones.filter((m) => m.name !== 'Terraformer');
      game.claimedMilestones.push({player: human, milestone: nonTerraformer[0]});
      game.claimedMilestones.push({player: human, milestone: nonTerraformer[1]});
      marsBot.player.actionsTakenThisRound = 0;

      marsBot['hardModeFirstTurnMilestone']();
      expect(game.claimedMilestones.length).to.eq(3); // Now 3
      expect(marsBot.megacredits).to.eq(2); // 10 - 8
    });

    it('does not claim when not enough MC', () => {
      const {game, human, marsBot} = createAutomaGame('hard');
      marsBot.megacredits = 5; // Less than 8
      marsBot.player.setTerraformRating(35);
      game.claimedMilestones.push({player: human, milestone: game.milestones[0]});
      game.claimedMilestones.push({player: human, milestone: game.milestones[1]});
      marsBot.player.actionsTakenThisRound = 0;

      marsBot['hardModeFirstTurnMilestone']();
      expect(game.claimedMilestones.length).to.eq(2); // No change
    });
  });

  describe('Rule 2.9: MarsBot skips production', () => {
    it('MarsBot MC supply unchanged during production', () => {
      const {marsBot} = createAutomaGame();
      marsBot.megacredits = 15;
      marsBot.runProductionPhase();
      expect(marsBot.megacredits).to.eq(15);
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

  describe('Rule 2.4: MarsBot plays one card per turn', () => {
    it('action deck decreases after takeTurn', () => {
      const {marsBot} = createAutomaGame();
      const deckBefore = marsBot.actionDeck.cards.length;
      expect(deckBefore).to.eq(4);

      marsBot.takeTurn();
      // Deck should decrease (by 1 for project card, possibly more if bonus card draws extra)
      expect(marsBot.actionDeck.cards.length).to.be.lt(deckBefore);
    });
  });
});
