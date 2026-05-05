import {Resource} from '../../src/common/Resource';
import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {AutomaGameSetup} from '../../src/server/automa/AutomaGameSetup';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {SeededRandom} from '../../src/common/utils/Random';
import {BoardName} from '../../src/common/boards/BoardName';
import {TileType} from '../../src/common/TileType';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: difficulty,
    boardName: BoardName.THARSIS,
  });

  // The game should have created a MarsBot
  expect(game.marsBot).to.not.be.undefined;

  return {game, human, marsBot: game.marsBot!};
}

describe('MarsBot', () => {
  describe('Setup', () => {
    it('creates MarsBot when automaOption is enabled', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot).to.not.be.undefined;
      expect(marsBot.player.name).to.eq('MarsBot');
    });

    it('MarsBot starts with TR 20', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.terraformRating).to.eq(20);
    });

    it('human player starts with TR 20 (not 14 like normal solo)', () => {
      const {human} = createAutomaGame();
      expect(human.terraformRating).to.eq(20);
    });

    it('MarsBot has initial action deck of 4 cards', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.actionDeck.length).to.eq(4);
    });

    it('milestones are not disabled in automa games', () => {
      const {game} = createAutomaGame();
      expect(game.allMilestonesClaimed()).to.be.false;
    });

    it('awards are not disabled in automa games', () => {
      const {game} = createAutomaGame();
      expect(game.allAwardsFunded()).to.be.false;
    });

    it('no neutral player cities in automa mode', () => {
      const {game} = createAutomaGame();
      // In normal solo, neutral player places 2 cities + 2 forests
      // In automa mode, that shouldn't happen
      const neutralTiles = game.board.spaces.filter((s) =>
        s.player !== undefined && s.player.name === 'neutral',
      );
      expect(neutralTiles.length).to.eq(0);
    });
  });

  describe('Action Deck', () => {
    it('builds research action deck with 4 cards (3 project + 1 bonus)', () => {
      const {marsBot} = createAutomaGame();
      marsBot.buildResearchActionDeck();
      expect(marsBot.actionDeck.length).to.eq(4);
    });

    it('brutal mode builds with 5 cards (4 project + 1 bonus)', () => {
      const {marsBot} = createAutomaGame('brutal');
      marsBot.buildResearchActionDeck();
      expect(marsBot.actionDeck.length).to.eq(5);
    });
  });

  describe('Turn Resolution', () => {
    it('MarsBot passes when action deck is empty', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.actionDeck = []; // Empty deck

      const passedBefore = game.hasPassedThisActionPhase(marsBot.player);
      expect(passedBefore).to.be.false;

      marsBot.takeTurn();

      const passedAfter = game.hasPassedThisActionPhase(marsBot.player);
      expect(passedAfter).to.be.true;
    });

    it('MarsBot action deck has cards after setup', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.actionDeck.length).to.eq(4);
    });
  });

  describe('Track Operations', () => {
    it('regressTrack reduces track position', () => {
      const {marsBot} = createAutomaGame();
      // Advance Track 1 to position 3
      const track = marsBot.board.tracks[0];
      track.advance(); // 1
      track.advance(); // 2
      track.advance(); // 3
      expect(track.position).to.eq(3);

      marsBot.regressTrack(Resource.STEEL); // Steel maps to Track 1
      expect(track.position).to.eq(2);
    });

    it('regressTrack maps production types correctly', () => {
      const {marsBot} = createAutomaGame();
      // Advance all tracks to position 1
      for (let i = 0; i < 7; i++) {
        marsBot.board.tracks[i].advance();
      }

      marsBot.regressTrack(Resource.TITANIUM); // → Track 2 (Space)
      expect(marsBot.board.tracks[1].position).to.eq(0);

      marsBot.regressTrack(Resource.MEGACREDITS); // → Track 3 (Event)
      expect(marsBot.board.tracks[2].position).to.eq(0);

      marsBot.regressTrack(Resource.ENERGY); // → Track 5 (Energy)
      expect(marsBot.board.tracks[4].position).to.eq(0);

      marsBot.regressTrack(Resource.HEAT); // → Track 6 (Earth)
      expect(marsBot.board.tracks[5].position).to.eq(0);

      marsBot.regressTrack(Resource.PLANTS); // → Track 7 (Plant)
      expect(marsBot.board.tracks[6].position).to.eq(0);
    });
  });

  describe('Production Phase', () => {
    it('MarsBot skips production (no resource changes)', () => {
      const {marsBot} = createAutomaGame();
      const mcBefore = marsBot.turnResolver.mcSupply;

      marsBot.runProductionPhase();

      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore);
    });
  });

  describe('Scoring', () => {
    it('calculates TR-only VP', () => {
      const {marsBot} = createAutomaGame();
      const vp = marsBot.getVictoryPoints();
      expect(vp.terraformRating).to.eq(20);
      expect(vp.total).to.be.gte(20);
    });

    it('instant win at generation 20', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 20;
      expect(marsBot.isInstantWin()).to.be.true;
    });

    it('no instant win before generation 20', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 19;
      expect(marsBot.isInstantWin()).to.be.false;
    });
  });

  describe('Game End', () => {
    it('game is over at generation 20 in automa mode', () => {
      const {game} = createAutomaGame();
      (game as any).generation = 20;
      expect(game.gameIsOver()).to.be.true;
    });

    it('game is over when Mars is terraformed', () => {
      const {game} = createAutomaGame();
      // Set all global params to max
      (game as any).oxygenLevel = 14;
      (game as any).temperature = 8;
      // Place 9 ocean tiles
      const oceanSpaces = game.board.getAvailableSpacesForOcean(game.players[0]);
      for (let i = 0; i < 9 && i < oceanSpaces.length; i++) {
        game.simpleAddTile(game.players[0], oceanSpaces[i], {tileType: TileType.OCEAN});
      }
      expect(game.marsIsTerraformed()).to.be.true;
      expect(game.gameIsOver()).to.be.true;
    });
  });
});
