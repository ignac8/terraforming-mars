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
import {storeRewoundSaves, UNDONE_LINES} from './RewoundGame';

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

    it('says not-finished to a judge with the password while the newest save is not END', async () => {
      const base: SerializedGame = game.serialize();
      db.games.set(game.id, [base, base, {...base, phase: Phase.ACTION}]);
      game.phase = Phase.END;
      scaffolding.url = `/api/replay/moves?id=${game.judgeId}&password=secret`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content)).deep.eq({status: 'not-finished'});
    });

    it('refuses a claimed judge seat with a wrong password while the game runs, also without Judge undo', async () => {
      scaffolding.url = `/api/replay/moves?id=${game.judgeId}&password=wrong`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.unauthorized);
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
  describe('a running game with history for those who may rewind', () => {
    // Every test game has the same id, so only the newest one is found.
    async function runningGame(options: Parameters<typeof testGame>[1]) {
      const [running, first] = testGame(2, {playerPasswords: true, ...options});
      await scaffolding.ctx.gameLoader.add(running);
      const base: SerializedGame = running.serialize();
      db.games.set(running.id, [base, base]);
      clearReplayCache();
      return {running, first};
    }

    async function read(query: string) {
      res = new MockResponse();
      scaffolding.url = `/api/replay/moves?${query}`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    }

    it('asks for a claimed seat\'s password', async () => {
      const seats = [
        {options: {judgeLink: true, judgeUndo: true}, claim: (g: IGame) => {
          g.judgePassword = 'secret';
        }, viewer: (g: IGame) => g.judgeId},
        {options: {undoOption: true}, claim: (_g: IGame, p: TestPlayer) => {
          p.password = 'secret';
        }, viewer: (_g: IGame, p: TestPlayer) => p.id},
      ];
      for (const seat of seats) {
        const {running, first} = await runningGame(seat.options);
        seat.claim(running, first);
        for (const [query, expected] of [['', statusCode.unauthorized], ['&password=wrong', statusCode.unauthorized], ['&password=secret', statusCode.ok]] as const) {
          await read(`id=${seat.viewer(running, first)}${query}`);
          expect(res.statusCode, `${JSON.stringify(seat.options)}${query}`).eq(expected);
          if (expected === statusCode.ok) {
            expect(JSON.parse(res.content).status).eq('available');
          }
        }
      }
    });

    it('does not claim a seat when it is read', async () => {
      const judged = await runningGame({judgeLink: true, judgeUndo: true});
      await read(`id=${judged.running.judgeId}`);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content).status).eq('available');
      expect(judged.running.judgePassword).is.undefined;
      const voted = await runningGame({undoOption: true});
      await read(`id=${voted.first.id}`);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content).status).eq('available');
      expect(voted.first.password).is.undefined;
    });

    it('keeps the history from a player of a game nobody may rewind, with the right password too', async () => {
      const noUndo = await runningGame({undoOption: false});
      noUndo.first.password = 'secret';
      await read(`id=${noUndo.first.id}&password=secret`);
      expect(JSON.parse(res.content)).deep.eq({status: 'not-finished'});
    });
  });

  describe('the undone moves of a rewound game', () => {
    // Every test game has the same id, so only the newest one is found.
    async function rewound(options: Parameters<typeof testGame>[1], finished: boolean) {
      const [rewoundGame, first, second] = testGame(2, {playerPasswords: true, ...options});
      await scaffolding.ctx.gameLoader.add(rewoundGame);
      storeRewoundSaves(db, rewoundGame, finished);
      clearReplayCache();
      return {game: rewoundGame, first, second};
    }

    async function read(query: string) {
      res = new MockResponse();
      scaffolding.url = `/api/replay/moves?${query}`;
      await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    }

    const texts = (moves: Array<{messages: Array<{message: string}>}>) => moves.flatMap((m) => m.messages.map((l) => l.message));

    for (const finished of [false, true]) {
      it(`shows the judge of a Judge undo game the undone moves when asked, ${finished ? 'after the game' : 'while it runs'}`, async () => {
        const {game: judged} = await rewound({judgeLink: true, judgeUndo: true}, finished);
        judged.judgePassword = 'secret';

        await read(`id=${judged.judgeId}&password=secret&undone=1`);
        expect(res.statusCode).eq(statusCode.ok);
        const moves = JSON.parse(res.content).moves;
        expect(moves.map((m: any) => [m.saveId, m.undone === true])).deep.eq([[0, false], [1, false], [2, true], [3, true], [4, true], [5, false]]);
        expect(texts(moves.filter((m: any) => m.undone))).deep.eq(UNDONE_LINES);

        await read(`id=${judged.judgeId}&password=secret`);
        const plain = JSON.parse(res.content).moves;
        expect(plain.map((m: any) => m.saveId)).deep.eq([0, 1, 5]);
        expect(plain.some((m: any) => m.undone !== undefined)).is.false;
        expect(texts(plain)).not.includes('line 5');
      });
    }

    for (const finished of [false, true]) {
      const runs = [
        {who: 'a player', options: {judgeLink: true, judgeUndo: true}, viewer: (_g: IGame, p: TestPlayer) => p.id},
        {who: 'a spectator', options: {judgeLink: true, judgeUndo: true}, viewer: (g: IGame) => g.spectatorId},
        {who: 'a vote player', options: {undoOption: true}, viewer: (_g: IGame, p: TestPlayer) => p.id},
        {who: 'the judge of a game without Judge undo', options: {judgeLink: true}, viewer: (g: IGame) => g.judgeId},
      ];
      for (const run of runs) {
        it(`refuses the undone moves to ${run.who}, ${finished ? 'after the game' : 'while it runs'}`, async () => {
          const {game: other, first} = await rewound(run.options, finished);
          await read(`id=${run.viewer(other, first)}&undone=1`);
          expect(res.statusCode).eq(statusCode.forbidden);
          expect(res.content).not.contains('line');

          // Without the parameter nobody gets a move the rewind undid.
          await read(`id=${run.viewer(other, first)}`);
          expect(res.statusCode).eq(statusCode.ok);
          const answer = JSON.parse(res.content);
          expect(texts(answer.moves ?? [])).not.includes('line 5');
          expect((answer.moves ?? []).some((m: any) => m.undone !== undefined)).is.false;
        });
      }
    }

    it('checks the judge password before it shows the undone moves', async () => {
      const {game: judged} = await rewound({judgeLink: true, judgeUndo: true}, true);
      judged.judgePassword = 'secret';
      for (const query of ['&password=wrong', '']) {
        await read(`id=${judged.judgeId}${query}&undone=1`);
        expect(res.statusCode, query).eq(statusCode.unauthorized);
        expect(res.content).not.contains('line');
      }
    });
  });
});
