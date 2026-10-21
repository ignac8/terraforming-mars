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
});
