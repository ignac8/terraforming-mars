import {expect} from 'chai';
import {ApiReplayMoves} from '../../src/server/routes/ApiReplayMoves';
import {IGame} from '../../src/server/IGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {clearReplayCache} from '../../src/server/replay/ReplayService';
import {LogMessage} from '../../src/common/logs/LogMessage';
import {LogMessageType} from '../../src/common/logs/LogMessageType';
import {Phase} from '../../src/common/Phase';
import {statusCode} from '../../src/common/http/statusCode';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiReplayMoves', () => {
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

  it('fails when id not provided', async () => {
    scaffolding.url = '/api/replay/moves';
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails when game not found', async () => {
    scaffolding.url = '/api/replay/moves?id=p-unknown-id';
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('lists moves of a finished game for a player', async () => {
    finishGame();
    scaffolding.url = '/api/replay/moves?id=' + player.id;
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content).status).eq('available');
  });

  it('lists moves of a finished game for a spectator', async () => {
    finishGame();
    scaffolding.url = '/api/replay/moves?id=' + game.spectatorId;
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content).status).eq('available');
  });

  describe('tournament access', () => {
    beforeEach(async () => {
      [game, player] = testGame(2, {judgeLink: true, playerPasswords: true});
      game.judgePassword = 'secret';
      await scaffolding.ctx.gameLoader.add(game);
    });

    it('lists moves for a judge with the right password', async () => {
      finishGame();
      scaffolding.url = `/api/replay/moves?id=${game.judgeId}&password=secret`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content).status).eq('available');
    });

    it('shows a judge every private log line with its owner, and a spectator only the public ones', async () => {
      const log = [
        new LogMessage(LogMessageType.DEFAULT, 'public one', []),
        new LogMessage(LogMessageType.DEFAULT, 'private to player', [], player.id),
        new LogMessage(LogMessageType.DEFAULT, 'public two', []),
      ];
      const base: SerializedGame = game.serialize();
      db.games.set(game.id, [
        {...base, gameLog: []},
        {...base, gameLog: log.slice(0, 1)},
        {...base, gameLog: log, phase: Phase.END},
      ]);
      game.phase = Phase.END;

      scaffolding.url = `/api/replay/moves?id=${game.judgeId}&password=secret`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      const spectatorRes = new MockResponse();
      scaffolding.url = '/api/replay/moves?id=' + game.spectatorId;
      await scaffolding.get(ApiReplayMoves.INSTANCE, spectatorRes);

      const judgeMessages = JSON.parse(res.content).moves.flatMap((m: any) => m.messages);
      expect(judgeMessages.map((m: any) => m.message)).deep.eq(['public one', 'private to player', 'public two']);
      expect(judgeMessages.map((m: any) => m.owner)).deep.eq([undefined, player.color, undefined]);
      expect(res.content).not.contains(player.id);
      const spectatorMessages = JSON.parse(spectatorRes.content).moves.flatMap((m: any) => m.messages);
      expect(spectatorMessages.map((m: any) => m.message)).deep.eq(['public one', 'public two']);
    });

    it('refuses a judge with a wrong password', async () => {
      finishGame();
      scaffolding.url = `/api/replay/moves?id=${game.judgeId}&password=wrong`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.unauthorized);
    });

    it('refuses a judge without a password', async () => {
      finishGame();
      scaffolding.url = `/api/replay/moves?id=${game.judgeId}`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.unauthorized);
    });

    it('does not find a judge id that belongs to no game', async () => {
      scaffolding.url = '/api/replay/moves?id=j-unknown-id&password=secret';
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.notFound);
    });

    it('does not claim an unclaimed player seat while the game runs', async () => {
      scaffolding.url = '/api/replay/moves?id=' + player.id;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content)).deep.eq({status: 'not-finished'});
      expect(player.password).is.undefined;
    });

    it('does not claim an unclaimed judge seat while the game runs', async () => {
      game.judgePassword = undefined;
      scaffolding.url = `/api/replay/moves?id=${game.judgeId}`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content)).deep.eq({status: 'not-finished'});
      expect(game.judgePassword).is.undefined;
    });

    it('lets a judge into a finished game without claiming an unclaimed judge seat', async () => {
      game.judgePassword = undefined;
      finishGame();
      scaffolding.url = `/api/replay/moves?id=${game.judgeId}`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content).status).eq('available');
      expect(game.judgePassword).is.undefined;
    });

    it('does not claim a player seat on a finished game', async () => {
      finishGame();
      scaffolding.url = '/api/replay/moves?id=' + player.id;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(player.password).is.undefined;
    });

    it('says not-finished before the judge password check while the newest save is not END', async () => {
      const base: SerializedGame = game.serialize();
      db.games.set(game.id, [base, base, {...base, phase: Phase.ACTION}]);
      game.phase = Phase.END;
      scaffolding.url = `/api/replay/moves?id=${game.judgeId}&password=wrong`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content)).deep.eq({status: 'not-finished'});
    });

    it('answers a player with the password while the game runs', async () => {
      player.password = 'seat-secret';
      scaffolding.url = '/api/replay/moves?id=' + player.id + '&password=seat-secret';
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content)).deep.eq({status: 'not-finished'});
    });

    it('lets a player into a finished game without a password, as everywhere else', async () => {
      player.password = 'seat-secret';
      finishGame();
      scaffolding.url = '/api/replay/moves?id=' + player.id;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
    });
  });

  it('rejects a game id', async () => {
    scaffolding.url = '/api/replay/moves?id=' + game.id;
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: invalid participant id');
  });

  it('says not-finished while the newest save is not in the END phase', async () => {
    const base: SerializedGame = game.serialize();
    db.games.set(game.id, [base, base, {...base, phase: Phase.ACTION}]);
    game.phase = Phase.END;
    scaffolding.url = '/api/replay/moves?id=' + player.id;
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content)).deep.eq({status: 'not-finished'});
  });

  it('says expired when fewer than 3 saves remain', async () => {
    const base: SerializedGame = game.serialize();
    db.games.set(game.id, [base, {...base, phase: Phase.END}]);
    game.phase = Phase.END;
    scaffolding.url = '/api/replay/moves?id=' + player.id;
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content)).deep.eq({status: 'expired'});
  });

  it('says not-finished for a running game', async () => {
    scaffolding.url = '/api/replay/moves?id=' + player.id;
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content)).deep.eq({status: 'not-finished'});
  });
});
