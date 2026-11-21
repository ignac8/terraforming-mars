import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {MarsBotScoring} from '../../src/server/automa/MarsBotScoring';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {MarsBotTurnResolver} from '../../src/server/automa/MarsBotTurnResolver';
import {standaloneMarsBot} from './corps/CorpGame';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {ColonyName} from '../../src/common/colonies/ColonyName';

describe('MarsBotScoring', () => {
  let game: IGame;
  let human: TestPlayer;
  let botPlayer: TestPlayer;
  let marsBot: MarsBot;
  let turnResolver: MarsBotTurnResolver;

  beforeEach(() => {
    [game, human] = testGame(1);
    botPlayer = TestPlayer.RED.newPlayer({name: 'marsbot'});
    botPlayer.game = game;
    marsBot = standaloneMarsBot(game, botPlayer, human, THARSIS_MARSBOT_BOARD);
    turnResolver = marsBot.turnResolver;
  });

  function makeScoring(neuralInstanceSpace?: Space) {
    return new MarsBotScoring(game, botPlayer, human, turnResolver, 'normal', neuralInstanceSpace);
  }

  describe('Terraform Rating', () => {
    it('includes terraform rating in VP', () => {
      botPlayer.setTerraformRating(25);
      const vp = makeScoring().calculate();
      expect(vp.terraformRating).to.eq(25);
    });

    it('default TR of 20', () => {
      const vp = makeScoring().calculate();
      expect(vp.terraformRating).to.eq(20);
    });
  });

  describe('Milestones', () => {
    it('counts milestones at 5 VP each', () => {
      game.claimedMilestones.push({player: botPlayer, milestone: game.milestones[0]});
      game.claimedMilestones.push({player: botPlayer, milestone: game.milestones[1]});
      const vp = makeScoring().calculate();
      expect(vp.milestones).to.eq(10);
    });

    it('does not count milestones claimed by human', () => {
      game.claimedMilestones.push({player: human, milestone: game.milestones[0]});
      const vp = makeScoring().calculate();
      expect(vp.milestones).to.eq(0);
    });

    it('counts 0 when no milestones claimed', () => {
      const vp = makeScoring().calculate();
      expect(vp.milestones).to.eq(0);
    });

    it('counts 3 milestones at 15 VP', () => {
      for (let i = 0; i < 3; i++) {
        game.claimedMilestones.push({player: botPlayer, milestone: game.milestones[i]});
      }
      const vp = makeScoring().calculate();
      expect(vp.milestones).to.eq(15);
    });
  });

  describe('Greenery VP', () => {
    it('counts greenery VP', () => {
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      game.simpleAddTile(botPlayer, spaces[5], {tileType: TileType.GREENERY});
      game.simpleAddTile(botPlayer, spaces[10], {tileType: TileType.GREENERY});
      game.simpleAddTile(botPlayer, spaces[15], {tileType: TileType.GREENERY});
      const vp = makeScoring().calculate();
      expect(vp.greenery).to.eq(3);
    });

    it('does not count human greenery', () => {
      const spaces = game.board.getAvailableSpacesOnLand(human);
      game.simpleAddTile(human, spaces[5], {tileType: TileType.GREENERY});
      const vp = makeScoring().calculate();
      expect(vp.greenery).to.eq(0);
    });
  });

  describe('City adjacent greenery VP', () => {
    it('counts adjacent greenery for MarsBot cities', () => {
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      const citySpace = spaces[15];
      game.simpleAddTile(botPlayer, citySpace, {tileType: TileType.CITY});
      const adj = game.board.getAdjacentSpaces(citySpace);
      let placed = 0;
      for (const s of adj) {
        if (s.tile === undefined && placed < 2) {
          game.simpleAddTile(botPlayer, s, {tileType: TileType.GREENERY});
          placed++;
        }
      }
      expect(placed).to.be.gte(1);
      const vp = makeScoring().calculate();
      const actualAdj = game.board.getAdjacentSpaces(citySpace).filter((s) => s.tile?.tileType === TileType.GREENERY).length;
      expect(vp.cityAdjacentGreenery).to.eq(actualAdj);
    });

    it('counts greenery from any player adjacent to MarsBot cities', () => {
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      const citySpace = spaces[15];
      game.simpleAddTile(botPlayer, citySpace, {tileType: TileType.CITY});
      const adj = game.board.getAdjacentSpaces(citySpace).filter((s) => s.tile === undefined);
      if (adj.length > 0) {
        game.simpleAddTile(human, adj[0], {tileType: TileType.GREENERY}); // Human's greenery
      }
      const vp = makeScoring().calculate();
      expect(vp.cityAdjacentGreenery).to.be.gte(1);
    });

    it('does not count adjacency for human cities', () => {
      const spaces = game.board.getAvailableSpacesOnLand(human);
      game.simpleAddTile(human, spaces[15], {tileType: TileType.CITY});
      const adj = game.board.getAdjacentSpaces(spaces[15]).filter((s) => s.tile === undefined);
      if (adj.length > 0) {
        game.simpleAddTile(botPlayer, adj[0], {tileType: TileType.GREENERY});
      }
      const vp = makeScoring().calculate();
      expect(vp.cityAdjacentGreenery).to.eq(0); // MarsBot has no cities
    });
  });

  describe('MC to VP conversion', () => {
    it('gen ≤12: 1 VP per 8 MC', () => {
      game.generation = 12;
      marsBot.megacredits = 24;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 13: 1 VP per 7 MC', () => {
      game.generation = 13;
      marsBot.megacredits = 21;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 14: 1 VP per 6 MC', () => {
      game.generation = 14;
      marsBot.megacredits = 13;
      expect(makeScoring().calculate().mcToVP).to.eq(2);
    });

    it('gen 15: 1 VP per 5 MC', () => {
      game.generation = 15;
      marsBot.megacredits = 23;
      expect(makeScoring().calculate().mcToVP).to.eq(4);
    });

    it('gen 16: 1 VP per 4 MC', () => {
      game.generation = 16;
      marsBot.megacredits = 9;
      expect(makeScoring().calculate().mcToVP).to.eq(2);
    });

    it('gen 17: 1 VP per 3 MC', () => {
      game.generation = 17;
      marsBot.megacredits = 10;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 18: 1 VP per 2 MC', () => {
      game.generation = 18;
      marsBot.megacredits = 7;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 19: 1 VP per 1 MC', () => {
      game.generation = 19;
      marsBot.megacredits = 7;
      expect(makeScoring().calculate().mcToVP).to.eq(7);
    });

    it('gen 20 (instant win): 0 MC VP', () => {
      game.generation = 20;
      marsBot.megacredits = 100;
      expect(makeScoring().calculate().mcToVP).to.eq(0);
    });

    it('fractional points rounded down', () => {
      game.generation = 14; // 1 per 6 MC
      marsBot.megacredits = 17;
      expect(makeScoring().calculate().mcToVP).to.eq(2); // floor(17/6) = 2
    });

    it('0 MC gives 0 VP', () => {
      game.generation = 14;
      marsBot.megacredits = 0;
      expect(makeScoring().calculate().mcToVP).to.eq(0);
    });
  });

  describe('Neural Instance', () => {
    it('0 VP when not placed', () => {
      expect(makeScoring(undefined).calculate().neuralInstance).to.eq(0);
    });

    it('counts adjacent spaces not occupied by human', () => {
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      const niSpace = spaces[15]; // Pick a non-edge space
      const adj = game.board.getAdjacentSpaces(niSpace);

      // Place human tile on one adjacent space
      const humanAdj = adj.find((s) => s.tile === undefined && s.spaceType === SpaceType.LAND);
      if (humanAdj) {
        game.simpleAddTile(human, humanAdj, {tileType: TileType.CITY});
      }

      const vp = makeScoring(niSpace).calculate();
      const adjCount = game.board.getAdjacentSpaces(niSpace).length;
      const humanAdjCount = humanAdj ? 1 : 0;
      expect(vp.neuralInstance).to.eq(adjCount - humanAdjCount);
    });
  });

  // TDaver, BGG 3408751 and 3373832: the resources MarsBot has left on the Colonies shipping board,
  // and its floaters on the Venus board, score half a VP each, rounded down
  describe('Leftover resources VP (automaColonyVP)', () => {
    function leftoverGame(options: {automaColonyVP?: boolean, coloniesExtension?: boolean, venusNextExtension?: boolean} = {}) {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, ...options});
      return {game, marsBot: game.automaHooks!.marsBot};
    }

    for (const run of [
      {cubes: 0, expected: 0},
      {cubes: 1, expected: 0},
      {cubes: 2, expected: 1},
      {cubes: 3, expected: 1},
      {cubes: 7, expected: 3},
    ] as const) {
      it('scores 1 VP for every 2 resources left on the shipping board, rounded down: ' + JSON.stringify(run), () => {
        const {marsBot} = leftoverGame({automaColonyVP: true});
        marsBot.shippingBoard.storage.set(ColonyName.CERES, Math.min(run.cubes, 4));
        marsBot.shippingBoard.storage.set(ColonyName.LUNA, Math.max(0, run.cubes - 4));
        expect(marsBot.getVictoryPoints().leftoverResourcesVP, `${run.cubes} resources`).to.eq(run.expected);
      });
    }

    it('counts the floaters on the Venus board too', () => {
      const {marsBot} = leftoverGame({automaColonyVP: true, venusNextExtension: true});
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 2);
      marsBot.floaters = 3;
      expect(marsBot.getVictoryPoints().leftoverResourcesVP).to.eq(2);
    });

    it('does not score MarsBot\'s colonies', () => {
      const {game, marsBot} = leftoverGame({automaColonyVP: true});
      for (let i = 0; i < 4; i++) {
        game.colonies[i].colonies.push(marsBot.player.id);
      }
      expect(marsBot.getVictoryPoints().leftoverResourcesVP).to.eq(0);
    });

    it('adds to the total', () => {
      const without = leftoverGame();
      const withOption = leftoverGame({automaColonyVP: true});
      for (const {marsBot} of [without, withOption]) {
        marsBot.shippingBoard.storage.set(ColonyName.CERES, 4);
      }
      expect(withOption.marsBot.getVictoryPoints().total).to.eq(without.marsBot.getVictoryPoints().total + 2);
    });

    it('is off by default', () => {
      const {marsBot} = leftoverGame();
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 4);
      expect(marsBot.getVictoryPoints().leftoverResourcesVP).to.eq(0);
    });

    it('scores nothing without Colonies', () => {
      const {marsBot} = leftoverGame({automaColonyVP: true, coloniesExtension: false, venusNextExtension: true});
      marsBot.floaters = 4;
      expect(marsBot.getVictoryPoints().leftoverResourcesVP).to.eq(0);
    });
  });

  describe('Total VP', () => {
    it('combines all VP sources', () => {
      botPlayer.setTerraformRating(25);
      marsBot.megacredits = 16;
      game.generation = 12; // 1 VP per 8 MC

      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      game.simpleAddTile(botPlayer, spaces[10], {tileType: TileType.GREENERY});

      const vp = makeScoring().calculate();
      expect(vp.terraformRating).to.eq(25);
      expect(vp.greenery).to.eq(1);
      expect(vp.mcToVP).to.eq(2); // 16/8
      expect(vp.total).to.eq(25 + 1 + 2);
    });
  });
});
