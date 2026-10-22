import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {ApiCreateGame} from '../../src/server/routes/ApiCreateGame';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {NewGameConfig} from '../../src/common/game/NewGameConfig';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {SimpleGameModel} from '../../src/common/models/SimpleGameModel';
import {FakeClock} from '../common/FakeClock';
import {CardName} from '../../src/common/cards/CardName';
import {isJudgeId} from '../../src/common/Types';

// A complete create-game request for a one-player game.
function newGameConfigForTest(): NewGameConfig {
  return {
    players: [{
      name: 'Robot',
      color: 'blue',
      beginner: false,
      handicap: 0,
      first: true,
    }],
    expansions: {
      corpera: true,
      promo: false,
      venus: false,
      colonies: false,
      prelude: false,
      prelude2: false,
      turmoil: false,
      community: false,
      ares: false,
      moon: false,
      pathfinders: false,
      ceo: false,
      starwars: false,
      underworld: false,
      deltaProject: false,
      tournament: false,
    },
    boards: [BoardName.THARSIS],
    seed: 0,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    playerPasswords: false,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 0,
    shuffleMapOption: false,
    randomMA: RandomMAOptionType.NONE,
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 0,
    startingPreludes: 0,
  };
}

describe('ApiCreateGame', () => {
  let scaffolding: RouteTestScaffolding;
  let req: MockRequest;
  let res: MockResponse;
  let apiCreateGame: ApiCreateGame;

  beforeEach(() => {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    apiCreateGame = new ApiCreateGame([{limit: 99999, perMs: 1}]);
  });

  it('no get', async () => {
    await scaffolding.get(apiCreateGame, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found');
  });

  it('simple create', async () => {
    const post = scaffolding.post(apiCreateGame, res);
    const emit = Promise.resolve().then(() => {
      const newGameConfig = newGameConfigForTest();
      req.emitString(JSON.stringify(newGameConfig));
      req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));
    expect(res.statusCode).eq(statusCode.ok);
    expect(res.headers.get('Content-Type')).eq('application/json');
    const model = JSON.parse(res.content) as SimpleGameModel;
    expect(model.id).is.not.undefined;
    expect(model.id.startsWith('g')).is.true;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    expect(game).is.not.undefined;
    expect(game!.players[0].name).eq('Robot');
  });

  it('red rover solo game', async () => {
    const post = scaffolding.post(apiCreateGame, res);
    const emit = Promise.resolve().then(() => {
      scaffolding.req.emitString(JSON.stringify({players: [{name: 'a player', color: 'red'}]}));
      scaffolding.req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));

    expect(res.statusCode).eq(statusCode.internalServerError);
  });

  async function postConfig(config: object) {
    const post = scaffolding.post(apiCreateGame, res);
    const emit = Promise.resolve().then(() => {
      scaffolding.req.emitString(JSON.stringify(config));
      scaffolding.req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));
  }

  const twoPlayers = [{name: 'a', color: 'red'}, {name: 'b', color: 'blue'}];

  it('rejects a custom corporation list smaller than players × starting corporations', async () => {
    await postConfig({
      players: twoPlayers,
      startingCorporations: 2,
      customCorporationsList: [CardName.CREDICOR, CardName.ECOLINE, CardName.HELION],
      customPreludes: [],
    });
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('at least 4 corporations');
  });

  it('accepts a custom corporation list of exactly players × starting corporations', async () => {
    await postConfig({
      players: twoPlayers,
      startingCorporations: 2,
      customCorporationsList: [CardName.CREDICOR, CardName.ECOLINE, CardName.HELION, CardName.INVENTRIX],
      customPreludes: [],
    });
    expect(res.statusCode).not.eq(statusCode.badRequest);
  });

  it('rejects a custom prelude list smaller than players × starting preludes', async () => {
    await postConfig({
      players: twoPlayers,
      startingPreludes: 4,
      customCorporationsList: [],
      customPreludes: [CardName.ALLIED_BANK, CardName.AQUIFER_TURBINES, CardName.BIOFUELS, CardName.BIOLAB, CardName.BIOSPHERE_SUPPORT, CardName.BUSINESS_EMPIRE, CardName.DOME_FARMING],
    });
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('at least 8 preludes');
  });

  it('rejects a custom CEO list smaller than players × CEOs dealt', async () => {
    await postConfig({
      players: twoPlayers,
      startingCeos: 1,
      customCorporationsList: [],
      customPreludes: [],
      customCeos: [CardName.FLOYD, CardName.HAL9000, CardName.KAREN, CardName.GORDON, CardName.ULRICH],
    });
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('at least 6 CEOs');
  });

  it('forces tournament locks on a created tournament game', async () => {
    const config = {
      ...newGameConfigForTest(),
      players: [
        {name: 'a', color: 'red', beginner: false, handicap: 3, first: true},
        {name: 'b', color: 'blue', beginner: false, handicap: 5, first: false},
      ],
      expansions: {...newGameConfigForTest().expansions, tournament: true},
      undoOption: true,
      fastModeOption: true,
      showOtherPlayersVP: true,
      playerPasswords: false,
      startingCorporations: 5,
      // Too short for 2 players × 5: must not be rejected, since it is discarded.
      customCorporationsList: [CardName.TERACTOR_TOURNAMENT],
      bannedCards: [CardName.MINE],
      includedCards: [CardName.MINE],
      customPreludes: [CardName.DONATION],
      customCeos: [CardName.FLOYD],
    };
    await postConfig(config);

    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as SimpleGameModel;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    expect(game).is.not.undefined;
    const options = game!.gameOptions;
    expect(options.undoOption).is.false;
    expect(options.fastModeOption).is.false;
    expect(options.showOtherPlayersVP).is.false;
    expect(options.playerPasswords).is.true;
    expect(options.customCorporationsList).is.empty;
    expect(options.bannedCards).is.empty;
    expect(options.includedCards).is.empty;
    expect(options.customPreludes).is.empty;
    expect(options.customCeos).is.empty;
    expect(game!.players.map((p) => p.handicap)).deep.eq([0, 0]);
  });

  it('treats a truthy non-boolean tournament flag as a tournament game', async () => {
    const config = {
      ...newGameConfigForTest(),
      players: [
        {name: 'a', color: 'red', beginner: false, handicap: 3, first: true},
        {name: 'b', color: 'blue', beginner: false, handicap: 0, first: false},
      ],
      expansions: {...newGameConfigForTest().expansions, tournament: 1 as unknown as boolean},
      undoOption: true,
    };
    await postConfig(config);

    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as SimpleGameModel;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    expect(game!.gameOptions.tournamentExpansion).is.true;
    expect(game!.gameOptions.undoOption).is.false;
    expect(game!.players.map((p) => p.handicap)).deep.eq([0, 0]);
  });

  it('gives a tournament game a judge id only when asked', async () => {
    const base = newGameConfigForTest();
    const tournamentExpansions = {...base.expansions, tournament: true};
    const configs = [
      {...base, expansions: tournamentExpansions, judgeLink: true},
      {...base, expansions: tournamentExpansions},
      {...base, judgeLink: true},
    ];
    const judgeIds: Array<string | undefined> = [];
    for (const config of configs) {
      req = new MockRequest();
      res = new MockResponse();
      scaffolding = new RouteTestScaffolding(req);
      await postConfig(config);
      expect(res.statusCode).eq(statusCode.ok);
      const model = JSON.parse(res.content) as SimpleGameModel;
      const game = await scaffolding.ctx.gameLoader.getGame(model.id);
      judgeIds.push(game!.judgeId);
    }
    expect(isJudgeId(judgeIds[0]!)).is.true;
    expect(judgeIds[1]).is.undefined;
    expect(judgeIds[2]).is.undefined;
  });

  it('gives a game judge undo only with the tournament preset, a judge link and the option', async () => {
    const base = newGameConfigForTest();
    const tournamentExpansions = {...base.expansions, tournament: true};
    for (const tournament of [true, false]) {
      for (const judgeLink of [true, false]) {
        for (const judgeUndo of [true, false]) {
          req = new MockRequest();
          res = new MockResponse();
          scaffolding = new RouteTestScaffolding(req);
          await postConfig({...base, expansions: tournament ? tournamentExpansions : base.expansions, judgeLink, judgeUndo});
          expect(res.statusCode).eq(statusCode.ok);
          const model = JSON.parse(res.content) as SimpleGameModel;
          const game = await scaffolding.ctx.gameLoader.getGame(model.id);
          expect(game!.gameOptions.judgeUndo, `${tournament} ${judgeLink} ${judgeUndo}`).eq(tournament && judgeLink && judgeUndo);
        }
      }
    }
  });

  it('keeps handicap in non-tournament games', async () => {
    const config = {
      ...newGameConfigForTest(),
      players: [{name: 'a', color: 'red', beginner: false, handicap: 3, first: true}],
    };
    await postConfig(config);

    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as SimpleGameModel;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    expect(game!.players[0].handicap).eq(3);
  });

  async function createdEscapeVelocity(escapeVelocity: object) {
    await postConfig({...newGameConfigForTest(), escapeVelocity});
    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as SimpleGameModel;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    return game?.gameOptions.escapeVelocity;
  }

  it('keeps valid escape velocity options', async () => {
    const options = {
      thresholdMinutes: 35,
      bonusSectionsPerAction: 2,
      penaltyPeriodMinutes: 3,
      penaltyVPPerPeriod: 1,
    };
    expect(await createdEscapeVelocity(options)).deep.eq(options);
  });

  it('replaces invalid escape velocity options with defaults', async () => {
    expect(await createdEscapeVelocity({
      thresholdMinutes: '35',
      bonusSectionsPerAction: 'x',
      penaltyPeriodMinutes: '',
      penaltyVPPerPeriod: 1,
    })).deep.eq({
      thresholdMinutes: 35,
      bonusSectionsPerAction: 2,
      penaltyPeriodMinutes: 2,
      penaltyVPPerPeriod: 1,
    });
  });

  it('rejects negative escape velocity options', async () => {
    await postConfig({
      ...newGameConfigForTest(),
      escapeVelocity: {
        thresholdMinutes: -5,
        bonusSectionsPerAction: 2,
        penaltyPeriodMinutes: 2,
        penaltyVPPerPeriod: 1,
      },
    });
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('Escape Velocity values cannot be negative');
  });

  // Issues one create-game POST against `handler`, using fresh request/response objects,
  // reusing `scaffolding.ctx` (and therefore its ip and clock) across calls.
  function postGame(handler: ApiCreateGame, request: MockRequest, response: MockResponse) {
    const post = handler.post(request, response, scaffolding.ctx);
    const emit = Promise.resolve().then(() => {
      request.emitString(JSON.stringify({players: [{name: 'a player', color: 'red'}]}));
      request.emitter.emit('end');
    });
    return Promise.all([emit, post]);
  }

  it('a quota handler does not block while under its limit', async () => {
    const apiCreateGame = new ApiCreateGame([{limit: 1, perMs: 120_000}]);

    const req1 = new MockRequest();
    const res1 = new MockResponse();
    await postGame(apiCreateGame, req1, res1);
    expect(res1.statusCode).not.eq(statusCode.tooManyRequests);
  });

  it('a quota handler blocks once its limit is exceeded', async () => {
    const apiCreateGame = new ApiCreateGame([{limit: 1, perMs: 120_000}]);

    const req1 = new MockRequest();
    const res1 = new MockResponse();
    await postGame(apiCreateGame, req1, res1);
    expect(res1.statusCode).not.eq(statusCode.tooManyRequests);

    const req2 = new MockRequest();
    const res2 = new MockResponse();
    await postGame(apiCreateGame, req2, res2);
    expect(res2.statusCode).eq(statusCode.tooManyRequests);
    expect(res2.content).eq('Quota exceeded');
  });

  it('two quota handlers do not block while both are under their limits', async () => {
    const apiCreateGame = new ApiCreateGame([{limit: 99999, perMs: 1}, {limit: 99999, perMs: 1}]);

    const req1 = new MockRequest();
    const res1 = new MockResponse();
    await postGame(apiCreateGame, req1, res1);
    expect(res1.statusCode).not.eq(statusCode.tooManyRequests);
  });

  it('two quota handlers block when the first exceeds its limit and the second does not', async () => {
    const apiCreateGame = new ApiCreateGame([{limit: 1, perMs: 120_000}, {limit: 99999, perMs: 1}]);

    const req1 = new MockRequest();
    const res1 = new MockResponse();
    await postGame(apiCreateGame, req1, res1);
    expect(res1.statusCode).not.eq(statusCode.tooManyRequests);

    const req2 = new MockRequest();
    const res2 = new MockResponse();
    await postGame(apiCreateGame, req2, res2);
    expect(res2.statusCode).eq(statusCode.tooManyRequests);
    expect(res2.content).eq('Quota exceeded');
  });

  it('two quota handlers block when the first does not exceed its limit but the second does', async () => {
    const apiCreateGame = new ApiCreateGame([{limit: 99999, perMs: 1}, {limit: 1, perMs: 120_000}]);

    const req1 = new MockRequest();
    const res1 = new MockResponse();
    await postGame(apiCreateGame, req1, res1);
    expect(res1.statusCode).not.eq(statusCode.tooManyRequests);

    const req2 = new MockRequest();
    const res2 = new MockResponse();
    await postGame(apiCreateGame, req2, res2);
    expect(res2.statusCode).eq(statusCode.tooManyRequests);
    expect(res2.content).eq('Quota exceeded');
  });

  it('elapsed time restores a blocked quota', async () => {
    const apiCreateGame = new ApiCreateGame([{limit: 1, perMs: 120_000}]);
    const clock = scaffolding.ctx.clock as FakeClock;

    const req1 = new MockRequest();
    const res1 = new MockResponse();
    await postGame(apiCreateGame, req1, res1);
    expect(res1.statusCode).not.eq(statusCode.tooManyRequests);

    const req2 = new MockRequest();
    const res2 = new MockResponse();
    await postGame(apiCreateGame, req2, res2);
    expect(res2.statusCode).eq(statusCode.tooManyRequests);

    clock.millis += 120_001;

    const req3 = new MockRequest();
    const res3 = new MockResponse();
    await postGame(apiCreateGame, req3, res3);
    expect(res3.statusCode).not.eq(statusCode.tooManyRequests);
  });
});
