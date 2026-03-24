import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBotScoring} from '../../src/server/automa/MarsBotScoring';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {MarsBotTurnResolver} from '../../src/server/automa/MarsBotTurnResolver';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';

describe('MarsBotScoring', () => {
  let game: IGame;
  let human: TestPlayer;
  let marsBot: TestPlayer;
  let board: MarsBotBoard;
  let turnResolver: MarsBotTurnResolver;

  beforeEach(() => {
    [game, human] = testGame(1);
    marsBot = TestPlayer.RED.newPlayer({name: 'marsbot'});
    (marsBot as any).game = game;
    board = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
    turnResolver = new MarsBotTurnResolver(game, marsBot, human, board, 'normal');
  });

  function makeScoring(neuralInstanceSpace?: any) {
    return new MarsBotScoring(game, marsBot, human, turnResolver, 'normal', neuralInstanceSpace);
  }

  describe('Terraform Rating', () => {
    it('includes terraform rating in VP', () => {
      marsBot.setTerraformRating(25);
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
      game.claimedMilestones.push({player: marsBot, milestone: game.milestones[0]});
      game.claimedMilestones.push({player: marsBot, milestone: game.milestones[1]});
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
        game.claimedMilestones.push({player: marsBot, milestone: game.milestones[i]});
      }
      const vp = makeScoring().calculate();
      expect(vp.milestones).to.eq(15);
    });
  });

  describe('Greenery VP', () => {
    it('counts greenery VP', () => {
      const spaces = game.board.getAvailableSpacesOnLand(marsBot);
      game.simpleAddTile(marsBot, spaces[5], {tileType: TileType.GREENERY});
      game.simpleAddTile(marsBot, spaces[10], {tileType: TileType.GREENERY});
      game.simpleAddTile(marsBot, spaces[15], {tileType: TileType.GREENERY});
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
      const spaces = game.board.getAvailableSpacesOnLand(marsBot);
      const citySpace = spaces[15];
      game.simpleAddTile(marsBot, citySpace, {tileType: TileType.CITY});
      const adj = game.board.getAdjacentSpaces(citySpace);
      let placed = 0;
      for (const s of adj) {
        if (s.tile === undefined && placed < 2) {
          game.simpleAddTile(marsBot, s, {tileType: TileType.GREENERY});
          placed++;
        }
      }
      expect(placed).to.be.gte(1);
      const vp = makeScoring().calculate();
      const actualAdj = game.board.getAdjacentSpaces(citySpace).filter((s) => s.tile?.tileType === TileType.GREENERY).length;
      expect(vp.cityAdjacentGreenery).to.eq(actualAdj);
    });

    it('counts greenery from any player adjacent to MarsBot cities', () => {
      const spaces = game.board.getAvailableSpacesOnLand(marsBot);
      const citySpace = spaces[15];
      game.simpleAddTile(marsBot, citySpace, {tileType: TileType.CITY});
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
        game.simpleAddTile(marsBot, adj[0], {tileType: TileType.GREENERY});
      }
      const vp = makeScoring().calculate();
      expect(vp.cityAdjacentGreenery).to.eq(0); // MarsBot has no cities
    });
  });

  describe('MC to VP conversion', () => {
    it('gen ≤12: 1 VP per 8 MC', () => {
      (game as any).generation = 12;
      turnResolver.mcSupply = 24;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 13: 1 VP per 7 MC', () => {
      (game as any).generation = 13;
      turnResolver.mcSupply = 21;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 14: 1 VP per 6 MC', () => {
      (game as any).generation = 14;
      turnResolver.mcSupply = 13;
      expect(makeScoring().calculate().mcToVP).to.eq(2);
    });

    it('gen 15: 1 VP per 5 MC', () => {
      (game as any).generation = 15;
      turnResolver.mcSupply = 23;
      expect(makeScoring().calculate().mcToVP).to.eq(4);
    });

    it('gen 16: 1 VP per 4 MC', () => {
      (game as any).generation = 16;
      turnResolver.mcSupply = 9;
      expect(makeScoring().calculate().mcToVP).to.eq(2);
    });

    it('gen 17: 1 VP per 3 MC', () => {
      (game as any).generation = 17;
      turnResolver.mcSupply = 10;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 18: 1 VP per 2 MC', () => {
      (game as any).generation = 18;
      turnResolver.mcSupply = 7;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 19: 1 VP per 1 MC', () => {
      (game as any).generation = 19;
      turnResolver.mcSupply = 7;
      expect(makeScoring().calculate().mcToVP).to.eq(7);
    });

    it('gen 20 (instant win): 0 MC VP', () => {
      (game as any).generation = 20;
      turnResolver.mcSupply = 100;
      expect(makeScoring().calculate().mcToVP).to.eq(0);
    });

    it('fractional points rounded down', () => {
      (game as any).generation = 14; // 1 per 6 MC
      turnResolver.mcSupply = 17;
      expect(makeScoring().calculate().mcToVP).to.eq(2); // floor(17/6) = 2
    });

    it('0 MC gives 0 VP', () => {
      (game as any).generation = 14;
      turnResolver.mcSupply = 0;
      expect(makeScoring().calculate().mcToVP).to.eq(0);
    });
  });

  describe('Neural Instance', () => {
    it('0 VP when not placed', () => {
      expect(makeScoring(undefined).calculate().neuralInstance).to.eq(0);
    });

    it('counts adjacent spaces not occupied by human', () => {
      const spaces = game.board.getAvailableSpacesOnLand(marsBot);
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

  describe('Instant win', () => {
    it('instant win at gen 20', () => {
      (game as any).generation = 20;
      expect(makeScoring().isInstantWin()).to.be.true;
    });

    it('no instant win at gen 19', () => {
      (game as any).generation = 19;
      expect(makeScoring().isInstantWin()).to.be.false;
    });
  });

  describe('Total VP', () => {
    it('combines all VP sources', () => {
      marsBot.setTerraformRating(25);
      turnResolver.mcSupply = 16;
      (game as any).generation = 12; // 1 VP per 8 MC

      const spaces = game.board.getAvailableSpacesOnLand(marsBot);
      game.simpleAddTile(marsBot, spaces[10], {tileType: TileType.GREENERY});

      const vp = makeScoring().calculate();
      expect(vp.terraformRating).to.eq(25);
      expect(vp.greenery).to.eq(1);
      expect(vp.mcToVP).to.eq(2); // 16/8
      expect(vp.total).to.eq(25 + 1 + 2);
    });
  });
});
