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

  it('shows a player of a finished game only their own private log lines, and a spectator only the public ones', async () => {
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

    scaffolding.url = '/api/replay/moves?id=' + player.id;
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    const spectatorRes = new MockResponse();
    scaffolding.url = '/api/replay/moves?id=' + game.spectatorId;
    await scaffolding.get(ApiReplayMoves.INSTANCE, spectatorRes);

    const playerMessages = JSON.parse(res.content).moves.flatMap((m: any) => m.messages);
    expect(playerMessages.map((m: any) => m.message)).deep.eq(['public one', 'private to player', 'public two']);
    const spectatorMessages = JSON.parse(spectatorRes.content).moves.flatMap((m: any) => m.messages);
    expect(spectatorMessages.map((m: any) => m.message)).deep.eq(['public one', 'public two']);
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

  // Every test game has the same id, so only the newest one is found.
  async function addGame(players: number, options: Parameters<typeof testGame>[1]) {
    const [added, first] = testGame(players, options);
    await scaffolding.ctx.gameLoader.add(added);
    return {added, first};
  }

  async function read(query: string) {
    res = new MockResponse();
    scaffolding.url = `/api/replay/moves?${query}`;
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
  }

  describe('a running game with history for those who may rewind', () => {
    it('answers the players of a game with Player undo, and keeps the history from everyone else', async () => {
      const runs = [
        {players: 2, options: {undoOption: true}, viewer: (_g: IGame, p: TestPlayer) => p.id, status: 'available'},
        {players: 1, options: {undoOption: true}, viewer: (_g: IGame, p: TestPlayer) => p.id, status: 'available'},
        {players: 2, options: {undoOption: true}, viewer: (g: IGame) => g.spectatorId, status: 'not-finished'},
        {players: 1, options: {undoOption: true}, viewer: (g: IGame) => g.spectatorId, status: 'not-finished'},
        {players: 2, options: {undoOption: false}, viewer: (_g: IGame, p: TestPlayer) => p.id, status: 'not-finished'},
        {players: 1, options: {undoOption: false}, viewer: (_g: IGame, p: TestPlayer) => p.id, status: 'not-finished'},
      ];
      for (const run of runs) {
        const {added, first} = await addGame(run.players, run.options);
        const base: SerializedGame = added.serialize();
        db.games.set(added.id, [base, base]);
        clearReplayCache();

        await read(`id=${run.viewer(added, first)}`);

        expect(res.statusCode, JSON.stringify(run)).eq(statusCode.ok);
        expect(JSON.parse(res.content).status, JSON.stringify(run)).eq(run.status);
      }
    });

    it('lets the solo player rewind it, and a player of a table vote on it', async () => {
      for (const [players, expected] of [[1, {canRewind: true, canVoteRewind: false}], [2, {canRewind: false, canVoteRewind: true}]] as const) {
        const {added, first} = await addGame(players, {undoOption: true});
        const base: SerializedGame = added.serialize();
        db.games.set(added.id, [base, base]);
        clearReplayCache();

        await read(`id=${first.id}`);

        expect(JSON.parse(res.content), String(players)).to.deep.include({status: 'available', finished: false, ...expected});
      }
    });
  });

  describe('a finished game with Player undo', () => {
    async function finished(players: number) {
      const {added, first} = await addGame(players, {undoOption: true});
      const base: SerializedGame = added.serialize();
      db.games.set(added.id, [base, base, {...base, phase: Phase.END}]);
      added.phase = Phase.END;
      clearReplayCache();
      return {added, first};
    }

    it('can be rewound by its solo player, and by nobody else', async () => {
      const {added, first} = await finished(1);

      await read(`id=${first.id}`);
      expect(JSON.parse(res.content)).to.deep.include({status: 'available', finished: true, canRewind: true, canVoteRewind: false});

      await read(`id=${added.spectatorId}`);
      expect(JSON.parse(res.content)).to.deep.include({status: 'available', finished: true, canRewind: false, canVoteRewind: false});
    });

    it('can no longer be rewound by a vote of its players', async () => {
      const {added, first} = await finished(2);

      for (const id of [first.id, added.spectatorId]) {
        await read(`id=${id}`);
        expect(JSON.parse(res.content), id).to.deep.include({status: 'available', finished: true, canRewind: false, canVoteRewind: false});
      }
    });
  });

  describe('a rewound game', () => {
    async function rewound(players: number, options: Parameters<typeof testGame>[1], finished: boolean) {
      const {added, first} = await addGame(players, options);
      storeRewoundSaves(db, added, finished);
      clearReplayCache();
      return {added, first};
    }

    const texts = (moves: Array<{messages: Array<{message: string}>}>) => moves.flatMap((m) => m.messages.map((l) => l.message));

    for (const finished of [false, true]) {
      it(`shows the solo player the undone moves when asked, ${finished ? 'after the game' : 'while it runs'}`, async () => {
        const {first} = await rewound(1, {undoOption: true}, finished);

        await read(`id=${first.id}&undone=1`);
        expect(res.statusCode).eq(statusCode.ok);
        const moves = JSON.parse(res.content).moves;
        expect(moves.map((m: any) => [m.saveId, m.undone === true])).deep.eq([[0, false], [1, false], [2, true], [3, true], [4, true], [5, false]]);
        expect(texts(moves.filter((m: any) => m.undone))).deep.eq(UNDONE_LINES);

        await read(`id=${first.id}`);
        const plain = JSON.parse(res.content).moves;
        expect(plain.map((m: any) => m.saveId)).deep.eq([0, 1, 5]);
        expect(plain.some((m: any) => m.undone !== undefined)).is.false;
        for (const line of UNDONE_LINES) {
          expect(texts(plain)).not.includes(line);
        }
      });
    }

    for (const finished of [false, true]) {
      const runs = [
        {who: 'a player of a table', players: 2, options: {undoOption: true}, viewer: (_g: IGame, p: TestPlayer) => p.id},
        {who: 'a spectator', players: 2, options: {undoOption: true}, viewer: (g: IGame) => g.spectatorId},
        {who: 'a spectator of a solo game', players: 1, options: {undoOption: true}, viewer: (g: IGame) => g.spectatorId},
        {who: 'the player of a solo game without Player undo', players: 1, options: {}, viewer: (_g: IGame, p: TestPlayer) => p.id},
      ];
      for (const run of runs) {
        it(`refuses the undone moves to ${run.who}, ${finished ? 'after the game' : 'while it runs'}`, async () => {
          const {added, first} = await rewound(run.players, run.options, finished);
          await read(`id=${run.viewer(added, first)}&undone=1`);
          expect(res.statusCode).eq(statusCode.forbidden);
          expect(res.content).not.contains('line');

          // Without the parameter nobody gets a move the rewind undid.
          await read(`id=${run.viewer(added, first)}`);
          expect(res.statusCode).eq(statusCode.ok);
          const answer = JSON.parse(res.content);
          for (const line of UNDONE_LINES) {
            expect(texts(answer.moves ?? [])).not.includes(line);
          }
          expect((answer.moves ?? []).some((m: any) => m.undone !== undefined)).is.false;
        });
      }
    }
  });
});
