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

  describe('tournament access', () => {
    beforeEach(async () => {
      [game, player] = testGame(2, {judgeLink: true, playerPasswords: true});
      game.judgePassword = 'secret';
      await scaffolding.ctx.gameLoader.add(game);
    });

    it('shows a judge the view with the right password', async () => {
      finishGame();
      await get(`id=${game.judgeId}&password=secret&save=1&as=all`);
      expect(res.statusCode).eq(statusCode.ok);
      const body = JSON.parse(res.content);
      expect(body.viewAs).eq('all');
      expect(body.view.id).eq(game.judgeId);
    });

    it('shows a judge one player, with no prompts', async () => {
      finishGame();
      await get(`id=${game.judgeId}&password=secret&save=1&as=${player.color}`);
      expect(res.statusCode).eq(statusCode.ok);
      const body = JSON.parse(res.content);
      expect(body.view.id).eq(game.judgeId);
      expect(body.view.waitingFor).is.undefined;
    });

    it('refuses a judge with a wrong password', async () => {
      finishGame();
      await get(`id=${game.judgeId}&password=wrong&save=1&as=all`);
      expect(res.statusCode).eq(statusCode.unauthorized);
    });

    it('refuses a judge without a password', async () => {
      finishGame();
      await get(`id=${game.judgeId}&save=1&as=all`);
      expect(res.statusCode).eq(statusCode.unauthorized);
    });

    it('does not find a judge id that belongs to no game', async () => {
      await get('id=j-unknown-id&password=secret&save=1&as=all');
      expect(res.statusCode).eq(statusCode.notFound);
    });

    it('does not claim an unclaimed player seat while the game runs', async () => {
      await get(`id=${player.id}&save=1&as=all`);
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(res.content).eq('Bad request: game not finished');
      expect(player.password).is.undefined;
    });

    it('does not claim an unclaimed judge seat while the game runs', async () => {
      game.judgePassword = undefined;
      await get(`id=${game.judgeId}&save=1&as=all`);
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(res.content).eq('Bad request: game not finished');
      expect(game.judgePassword).is.undefined;
    });

    it('lets a judge into a finished game without claiming an unclaimed judge seat', async () => {
      game.judgePassword = undefined;
      finishGame();
      await get(`id=${game.judgeId}&save=1&as=all`);
      expect(res.statusCode).eq(statusCode.ok);
      expect(game.judgePassword).is.undefined;
    });

    it('does not claim a player seat on a finished game', async () => {
      finishGame();
      await get(`id=${player.id}&save=1&as=all`);
      expect(res.statusCode).eq(statusCode.ok);
      expect(player.password).is.undefined;
    });

    describe('seat password', () => {
      beforeEach(() => {
        player.password = 'seat-secret';
        finishGame();
      });

      it('never reaches a spectator looking at one player', async () => {
        await get(`id=${game.spectatorId}&save=1&as=${player.color}`);
        expect(res.statusCode).eq(statusCode.ok);
        expect(res.content).not.contains('seat-secret');
        expect(JSON.parse(res.content).view.password).is.undefined;
      });

      it('never reaches a judge looking at one player', async () => {
        await get(`id=${game.judgeId}&password=secret&save=1&as=${player.color}`);
        expect(res.statusCode).eq(statusCode.ok);
        expect(res.content).not.contains('seat-secret');
        expect(JSON.parse(res.content).view.password).is.undefined;
      });

      it('never reaches a player looking at their own seat', async () => {
        await get(`id=${player.id}&save=1&as=${player.color}`);
        expect(res.statusCode).eq(statusCode.ok);
        expect(res.content).not.contains('seat-secret');
        expect(JSON.parse(res.content).view.password).is.undefined;
      });

      it('is not in the all-hands view', async () => {
        await get(`id=${game.spectatorId}&save=1&as=all`);
        expect(res.statusCode).eq(statusCode.ok);
        expect(res.content).not.contains('seat-secret');
      });
    });

    it('lets a player into a finished game without a password, as everywhere else', async () => {
      player.password = 'seat-secret';
      finishGame();
      await get(`id=${player.id}&save=1&as=all`);
      expect(res.statusCode).eq(statusCode.ok);
    });
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
      const [running, first, second] = testGame(2, {playerPasswords: true, ...options});
      await scaffolding.ctx.gameLoader.add(running);
      const base: SerializedGame = running.serialize();
      db.games.set(running.id, [base, base]);
      clearReplayCache();
      return {running, first, second};
    }

    it('shows the judge any view of a judge-undo game', async () => {
      const {running, first} = await runningGame({judgeLink: true, judgeUndo: true});
      for (const as of ['all', first.color]) {
        res = new MockResponse();
        await get(`id=${running.judgeId}&save=0&as=${as}`);
        expect(res.statusCode, as).eq(statusCode.ok);
        expect(JSON.parse(res.content).viewAs).eq(as);
      }
    });

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
        {options: {judgeLink: true}, viewer: (g: IGame) => g.judgeId},
        {options: {judgeLink: true, judgeUndo: true}, viewer: (_g: IGame, p: TestPlayer) => p.id},
        {options: {judgeLink: true, judgeUndo: true}, viewer: (g: IGame) => g.spectatorId},
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

    it('asks for a claimed seat\'s password', async () => {
      const seats = [
        {options: {judgeLink: true, judgeUndo: true}, claim: (g: IGame) => {
          g.judgePassword = 'secret';
        }, viewer: (g: IGame) => g.judgeId, as: () => 'all'},
        {options: {undoOption: true}, claim: (_g: IGame, p: TestPlayer) => {
          p.password = 'secret';
        }, viewer: (_g: IGame, p: TestPlayer) => p.id, as: (p: TestPlayer) => p.color},
      ];
      for (const seat of seats) {
        const {running, first} = await runningGame(seat.options);
        seat.claim(running, first);
        for (const [query, expected] of [['', statusCode.unauthorized], ['&password=wrong', statusCode.unauthorized], ['&password=secret', statusCode.ok]] as const) {
          res = new MockResponse();
          await get(`id=${seat.viewer(running, first)}&save=0&as=${seat.as(first)}${query}`);
          expect(res.statusCode, `${JSON.stringify(seat.options)}${query}`).eq(expected);
        }
      }
    });

    it('does not claim a seat when it is read', async () => {
      const judged = await runningGame({judgeLink: true, judgeUndo: true});
      await get(`id=${judged.running.judgeId}&save=0&as=all`);
      expect(res.statusCode).eq(statusCode.ok);
      expect(judged.running.judgePassword).is.undefined;
      const voted = await runningGame({undoOption: true});
      res = new MockResponse();
      await get(`id=${voted.first.id}&save=0&as=${voted.first.color}`);
      expect(res.statusCode).eq(statusCode.ok);
      expect(voted.first.password).is.undefined;
    });
  });
});
