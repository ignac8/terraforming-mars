import {Resource} from '../../src/common/Resource';
import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {TileType} from '../../src/common/TileType';
import {maxOutOceans, setOxygenLevel, setTemperature} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automa: true,
    automaDifficulty: difficulty,
    boardName: BoardName.THARSIS,
  });

  // The game should have created a MarsBot
  expect(game.automaHooks?.marsBot).to.not.be.undefined;

  return {game, human, marsBot: game.automaHooks!.marsBot};
}

describe('MarsBot', () => {
  describe('Setup', () => {
    it('creates MarsBot when automa is enabled', () => {
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
      const track = marsBot.marsBotBoard.tracks[0];
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
        marsBot.marsBotBoard.tracks[i].advance();
      }

      marsBot.regressTrack(Resource.TITANIUM); // → Track 2 (Space)
      expect(marsBot.marsBotBoard.tracks[1].position).to.eq(0);

      marsBot.regressTrack(Resource.MEGACREDITS); // → Track 3 (Event)
      expect(marsBot.marsBotBoard.tracks[2].position).to.eq(0);

      marsBot.regressTrack(Resource.ENERGY); // → Track 5 (Energy)
      expect(marsBot.marsBotBoard.tracks[4].position).to.eq(0);

      marsBot.regressTrack(Resource.HEAT); // → Track 6 (Earth)
      expect(marsBot.marsBotBoard.tracks[5].position).to.eq(0);

      marsBot.regressTrack(Resource.PLANTS); // → Track 7 (Plant)
      expect(marsBot.marsBotBoard.tracks[6].position).to.eq(0);
    });
  });

  describe('Production Phase', () => {
    it('MarsBot skips production (no resource changes)', () => {
      const {marsBot} = createAutomaGame();
      const mcBefore = marsBot.turnResolver.megacredits;

      marsBot.runProductionPhase();

      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore);
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
      game.generation = 20;
      expect(marsBot.isInstantWin()).to.be.true;
    });

    it('no instant win before generation 20', () => {
      const {game, marsBot} = createAutomaGame();
      game.generation = 19;
      expect(marsBot.isInstantWin()).to.be.false;
    });
  });

  describe('Game End', () => {
    it('game is over at generation 20 in automa mode', () => {
      const {game} = createAutomaGame();
      game.generation = 20;
      expect(game.gameIsOver()).to.be.true;
    });

    it('game is over when Mars is terraformed', () => {
      const {game} = createAutomaGame();
      // Set all global params to max
      setOxygenLevel(game, 14);
      setTemperature(game, 8);
      // Place 9 ocean tiles
      const oceanSpaces = game.board.getAvailableSpacesForOcean(game.players[0]);
      for (let i = 0; i < 9 && i < oceanSpaces.length; i++) {
        game.simpleAddTile(game.players[0], oceanSpaces[i], {tileType: TileType.OCEAN});
      }
      expect(game.marsIsTerraformed()).to.be.true;
      expect(game.gameIsOver()).to.be.true;
    });
  });

  describe('Bonus card members', () => {
    it('maybeAdvanceTrack leaves a maxed track where it is, with no Failed Action', () => {
      const {marsBot} = createAutomaGame();
      const power = marsBot.marsBotBoard.tracks[4];
      const max = power.definition.layout.length - 1;
      power.position = max;

      marsBot.maybeAdvanceTrack(4);

      expect(power.position).to.eq(max);
      expect(marsBot.megacredits).to.eq(0);
    });

    for (const run of [
      {megacredits: 20, expected: {lost: 5, left: 15}},
      {megacredits: 2, expected: {lost: 2, left: 0}},
    ] as const) {
      it('loseMc takes up to the amount, stopping at zero: ' + JSON.stringify(run), () => {
        const {marsBot} = createAutomaGame();
        marsBot.megacredits = run.megacredits;

        const lost = marsBot.loseMc(5);

        expect(lost).to.eq(run.expected.lost);
        expect(marsBot.megacredits).to.eq(run.expected.left);
      });
    }

    for (const run of [
      {temperature: -30, oxygen: 0, oceans: 0, expected: {temperature: -28, oxygen: 0, oceans: 0}},
      {temperature: 0, oxygen: 0, oceans: 0, expected: {temperature: 0, oxygen: 1, oceans: 0}},
      {temperature: 0, oxygen: 9, oceans: 0, expected: {temperature: 0, oxygen: 9, oceans: 1}},
      // Oxygen and temperature both have 9 steps left, though temperature is further along
      {temperature: -10, oxygen: 5, oceans: 9, expected: {temperature: -10, oxygen: 6, oceans: 9}},
    ] as const) {
      it('advanceFurthestParameter raises the parameter with the most steps left: ' + JSON.stringify(run), () => {
        const {game, human, marsBot} = createAutomaGame();
        setTemperature(game, run.temperature);
        setOxygenLevel(game, run.oxygen);
        maxOutOceans(human, run.oceans);

        marsBot.advanceFurthestParameter(CardName.AUTOMA_LOBBYISTS);

        expect({
          temperature: game.getTemperature(),
          oxygen: game.getOxygenLevel(),
          oceans: game.board.getOceanSpaces().length,
        }).deep.eq(run.expected);
      });
    }

    for (const run of [
      {allowCorpIntercept: true, expected: -30},
      {allowCorpIntercept: false, expected: -28},
    ] as const) {
      it('advanceFurthestParameter lets a corp cancel the raise only when allowed: ' + JSON.stringify(run), () => {
        const {game, marsBot} = createAutomaGame();
        marsBot.interceptsParameterRaise = () => true;

        marsBot.advanceFurthestParameter(CardName.AUTOMA_GOVERNMENT_INTERVENTION, run.allowCorpIntercept);

        expect(game.getTemperature()).to.eq(run.expected);
      });
    }

    for (const run of [
      {accepted: ['21'], expected: {placed: true, oxygen: 1}},
      {accepted: [], expected: {placed: false, oxygen: 0}},
    ] as const) {
      it('maybePlaceGreenery places a greenery only on a space the filter accepts, raising the oxygen: ' + JSON.stringify(run), () => {
        const {game, marsBot} = createAutomaGame();
        const accepted: ReadonlyArray<string> = run.accepted;

        const placed = marsBot.maybePlaceGreenery((space) => accepted.includes(space.id));

        expect(game.board.getGreeneries(marsBot.player).map((space) => space.id)).deep.eq(accepted);
        expect(game.getOxygenLevel()).to.eq(run.expected.oxygen);
        expect(placed).to.eq(run.expected.placed);
      });
    }

    it('withoutTRorMcGain takes back the TR and M€ the action gives', () => {
      const {marsBot} = createAutomaGame();
      const tr = marsBot.player.terraformRating;

      marsBot.withoutTRorMcGain(() => {
        marsBot.player.increaseTerraformRating(2);
        marsBot.gainMc(6);
      });

      expect(marsBot.player.terraformRating).to.eq(tr);
      expect(marsBot.megacredits).to.eq(0);
    });

    it('withoutMcGain leaves M€ the action spends spent', () => {
      const {marsBot} = createAutomaGame();
      marsBot.megacredits = 10;

      marsBot.withoutMcGain(() => marsBot.loseMc(4));

      expect(marsBot.megacredits).to.eq(6);
    });
  });
});
