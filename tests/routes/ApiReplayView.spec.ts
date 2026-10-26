import {expect} from 'chai';
import {ApiReplayView} from '../../src/server/routes/ApiReplayView';
import {clearReplayCache} from '../../src/server/replay/ReplayService';
import {IGame} from '../../src/server/IGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {PLAYER_COLORS} from '../../src/common/Color';
import {Phase} from '../../src/common/Phase';
import {statusCode} from '../../src/common/http/statusCode';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {storeRewoundSaves} from './RewoundGame';

describe('ApiReplayView', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;
  let db: InMemoryDatabase;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(async () => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
    db = new InMemoryDatabase();
    setTestDatabase(db);
    clearReplayCache();
    [game, player] = testGame(2);
    await scaffolding.ctx.gameLoader.add(game);
  });

  afterEach(() => {
    restoreTestDatabase();
    clearReplayCache();
  });

  // The newest save of a finished game is in the END phase.
  function finishGame() {
    const base: SerializedGame = game.serialize();
    db.games.set(game.id, [base, base, {...base, phase: Phase.END}]);
    game.phase = Phase.END;
  }

  async function get(query: string) {
    scaffolding.url = '/api/replay/view?' + query;
    await scaffolding.get(ApiReplayView.INSTANCE, res);
  }

  it('fails when id not provided', async () => {
    await get('save=1&as=all');
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails when game not found', async () => {
    await get('id=p-unknown-id&save=1&as=all');
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('rejects a game id', async () => {
    await get(`id=${game.id}&save=1&as=all`);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: invalid participant id');
  });

  it('fails when the game is not finished', async () => {
    await get(`id=${player.id}&save=1&as=all`);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: game not finished');
  });

  it('fails while the END save has not been written yet', async () => {
    const base: SerializedGame = game.serialize();
    db.games.set(game.id, [base, base, {...base, phase: Phase.ACTION}]);
    game.phase = Phase.END;
    await get(`id=${player.id}&save=1&as=all`);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: game not finished');
  });

  ['abc', '-1', '1.5', ''].forEach((save) => {
    it(`fails when save is "${save}"`, async () => {
      finishGame();
      await get(`id=${player.id}&save=${save}&as=all`);
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(res.content).eq('Bad request: invalid save');
    });
  });

  it('fails when save is missing', async () => {
    finishGame();
    await get(`id=${player.id}&as=all`);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: missing save parameter');
  });

  it('fails when save does not exist', async () => {
    finishGame();
    await get(`id=${player.id}&save=99&as=all`);
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('fails when as is not a color', async () => {
    finishGame();
    await get(`id=${player.id}&save=1&as=octarine`);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: invalid as');
  });

  it('fails when as is missing', async () => {
    finishGame();
    await get(`id=${player.id}&save=1`);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: missing as parameter');
  });

  it('fails when as is a color no player has', async () => {
    finishGame();
    const absent = PLAYER_COLORS.find((c) => !game.players.some((p) => p.color === c))!;
    await get(`id=${player.id}&save=1&as=${absent}`);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: unknown color');
  });

  it('shows every hand for as=all', async () => {
    finishGame();
    await get(`id=${player.id}&save=1&as=all`);
    expect(res.statusCode).eq(statusCode.ok);
    const body = JSON.parse(res.content);
    expect(body.saveId).eq(1);
    expect(body.viewAs).eq('all');
    expect(body.privates).has.length(2);
  });

  it('shows one player for as=<color>, to a spectator', async () => {
    finishGame();
    await get(`id=${game.spectatorId}&save=1&as=${player.color}`);
    expect(res.statusCode).eq(statusCode.ok);
    const body = JSON.parse(res.content);
    expect(body.viewAs).eq(player.color);
    expect(body.privates).deep.eq([]);
  });

  it('refuses every view but their own to the player of a running game', async () => {
    const [solo, soloPlayer] = testGame(1, {undoOption: true});
    await scaffolding.ctx.gameLoader.add(solo);
    const base: SerializedGame = solo.serialize();
    db.games.set(solo.id, [base, base]);
    for (const as of ['all', PLAYER_COLORS.find((c) => c !== soloPlayer.color)!]) {
      res = new MockResponse();
      await get(`id=${soloPlayer.id}&save=0&as=${as}`);
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(res.content).eq('Bad request: only your own view while the game runs');
    }
    res = new MockResponse();
    await get(`id=${solo.spectatorId}&save=0&as=${soloPlayer.color}`);
    expect(res.content).eq('Bad request: game not finished');
    res = new MockResponse();
    await get(`id=${soloPlayer.id}&save=0&as=${soloPlayer.color}`);
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content).viewAs).eq(soloPlayer.color);
  });

  describe('a running game with history for those who may rewind', () => {
    // Every test game has the same id, so only the newest one is found. Two rows, so that save 0 can be read.
    async function runningGame(options: Parameters<typeof testGame>[1]) {
      const [running, first, second] = testGame(2, options);
      await scaffolding.ctx.gameLoader.add(running);
      const base: SerializedGame = running.serialize();
      db.games.set(running.id, [base, base]);
      clearReplayCache();
      return {running, first, second};
    }

    it('shows a vote player only their own view', async () => {
      const {first, second} = await runningGame({undoOption: true});
      for (const [as, expected] of [[first.color, statusCode.ok], ['all', statusCode.badRequest], [second.color, statusCode.badRequest]] as const) {
        res = new MockResponse();
        await get(`id=${first.id}&save=0&as=${as}`);
        expect(res.statusCode, as).eq(expected);
        if (expected === statusCode.badRequest) {
          expect(res.content).eq('Bad request: only your own view while the game runs');
        }
      }
    });

    it('refuses the view to those who may not rewind', async () => {
      const runs = [
        {options: {undoOption: false}, viewer: (_g: IGame, p: TestPlayer) => p.id},
        {options: {undoOption: true}, viewer: (g: IGame) => g.spectatorId},
      ];
      for (const run of runs) {
        const {running, first} = await runningGame(run.options);
        res = new MockResponse();
        await get(`id=${run.viewer(running, first)}&save=0&as=${first.color}`);
        expect(res.statusCode, JSON.stringify(run.options)).eq(statusCode.badRequest);
        expect(res.content).eq('Bad request: game not finished');
      }
    });
  });

  describe('a save that a rewind undid', () => {
    // Save 3 is one of the saves 2 to 4 that the rewind abandoned. Every test game has the same id, so only the newest one is found.
    const UNDONE_SAVE = 3;
    const KEPT_SAVE = 1;

    async function rewound(players: number, finished: boolean) {
      const [rewoundGame, first] = testGame(players, {undoOption: true});
      await scaffolding.ctx.gameLoader.add(rewoundGame);
      storeRewoundSaves(db, rewoundGame, finished);
      clearReplayCache();
      res = new MockResponse();
      return {game: rewoundGame, first};
    }

    for (const finished of [false, true]) {
      const runs = [
        {who: 'the solo player', players: 1, viewer: (_g: IGame, p: TestPlayer) => p.id},
        {who: 'a player of a table', players: 2, viewer: (_g: IGame, p: TestPlayer) => p.id},
        // A running game keeps its history from a spectator.
        ...(finished ? [{who: 'a spectator', players: 2, viewer: (g: IGame) => g.spectatorId}] : []),
      ];
      for (const run of runs) {
        it(`does not find the save for ${run.who}, also when asked for the undone moves, ${finished ? 'after the game' : 'while it runs'}`, async () => {
          const {game: other, first} = await rewound(run.players, finished);
          const id = run.viewer(other, first);

          // An undone parameter, as an older page sent it to a judge, shows nothing more.
          for (const query of ['', '&undone=1']) {
            res = new MockResponse();
            await get(`id=${id}&save=${UNDONE_SAVE}&as=${first.color}${query}`);
            expect(res.statusCode, query).eq(statusCode.notFound);
          }

          res = new MockResponse();
          await get(`id=${id}&save=${KEPT_SAVE}&as=${first.color}`);
          expect(res.statusCode).eq(statusCode.ok);
          expect(JSON.parse(res.content).saveId).eq(KEPT_SAVE);
        });
      }
    }
  });
});
