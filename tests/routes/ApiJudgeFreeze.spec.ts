import {expect} from 'chai';
import {ApiJudgeFreeze} from '../../src/server/routes/ApiJudgeFreeze';
import {PlayerInput} from '../../src/server/routes/PlayerInput';
import {Handler} from '../../src/server/routes/Handler';
import {IGame} from '../../src/server/IGame';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {isTableLocked, withTableLock} from '../../src/server/rewind/tableLock';
import {INVALID_REQUEST_ID} from '../../src/common/app/AppErrorId';
import {JudgeModel} from '../../src/common/models/JudgeModel';
import {Phase} from '../../src/common/Phase';
import {statusCode} from '../../src/common/http/statusCode';
import {cast} from '../../src/common/utils/utils';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestingUtils';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

const PASSWORD = '0123456789ab';

describe('ApiJudgeFreeze', () => {
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;
  let game: IGame;
  let player: TestPlayer;

  async function start(options: Parameters<typeof testGame>[1] = {}) {
    setTestDatabase(new SnapshotDatabase());
    [game, player] = testGame(2, {judgeLink: true, judgeUndo: true, ...options});
    game.judgePassword = PASSWORD;
    game.phase = Phase.ACTION;
    player.takeAction();
    scaffolding = new RouteTestScaffolding();
    await scaffolding.ctx.gameLoader.add(game);
  }

  // The route reads the body off the 'data'/'end' events, so the body has to be emitted after
  // post() is called and the route has taken the game, but before post() is awaited. Each call gets a fresh request and response.
  async function send(handler: Handler, url: string, body: string) {
    const req = new MockRequest();
    res = new MockResponse();
    scaffolding.req = req;
    scaffolding.url = url;
    const response = scaffolding.post(handler, res);
    const emit = new Promise((resolve) => setImmediate(resolve)).then(() => {
      req.emitString(body);
      req.emitter.emit('end');
    });
    await Promise.all([emit, response]);
  }

  function freeze(frozen: unknown, query = '&password=' + PASSWORD, id: string = game.judgeId!) {
    return send(ApiJudgeFreeze.INSTANCE, `/api/judge/freeze?id=${id}${query}`, JSON.stringify({frozen}));
  }

  // The player's answer to the current action prompt: passing.
  function pass() {
    const waitingFor = cast(player.getWaitingFor(), OrOptions);
    const index = waitingFor.options.findIndex((option) => option.title === 'Pass for this generation');
    return send(PlayerInput.INSTANCE, `/player/input?id=${player.id}`, JSON.stringify({requestId: waitingFor.requestId, type: 'or', index, response: {type: 'option'}}));
  }

  afterEach(() => {
    restoreTestDatabase();
  });

  it('freezes the game so inputs are refused, and unfreezes it so they are taken again', async () => {
    await start();

    await freeze(true);
    expect(res.statusCode).eq(statusCode.ok);
    const model: JudgeModel = JSON.parse(res.content);
    expect(model.game.frozen).is.true;
    expect(game.frozen).is.true;

    await pass();
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(JSON.parse(res.content).id).eq(INVALID_REQUEST_ID);

    // A stale judge tab asking for the state the game is already in is refused.
    await freeze(true);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: The game is already frozen.');

    await freeze(false);
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content).game.frozen).is.false;

    await freeze(false);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: The game is not frozen.');

    await pass();
    expect(res.statusCode).eq(statusCode.ok);
  });

  it('refuses a finished game', async () => {
    await start();
    game.phase = Phase.END;

    await freeze(true);

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: The game has ended.');
    expect(game.frozen).is.false;
  });

  it('refuses a game without judge undo, a player id, a wrong password and a held lock, and changes nothing', async () => {
    await start({judgeUndo: false});
    await freeze(true);
    expect(res.statusCode, 'no judge undo').eq(statusCode.forbidden);

    await start();
    await freeze(true, undefined, player.id);
    expect(res.statusCode, 'player id').eq(statusCode.badRequest);

    for (const query of ['', '&password=deadbeef']) {
      await freeze(true, query);
      expect(res.statusCode, query).eq(statusCode.unauthorized);
    }

    let release = () => {};
    const held = withTableLock(game.id, () => new Promise<void>((resolve) => release = resolve));
    await freeze(true);
    release();
    await held;
    expect(res.statusCode, 'lock').eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: A rewind is already running.');
    expect(game.frozen).is.false;
  });

  it('refuses a body that is not exactly a boolean', async () => {
    await start();
    const bodies: Array<string> = [
      {frozen: 'yes'},
      {frozen: 1},
      {},
      {frozen: true, extra: 1},
      true,
      [],
      null,
    ].map((body) => JSON.stringify(body));
    bodies.push('not json');
    for (const body of bodies) {
      await send(ApiJudgeFreeze.INSTANCE, `/api/judge/freeze?id=${game.judgeId}&password=${PASSWORD}`, body);
      expect(res.statusCode, body).eq(statusCode.badRequest);
      expect(res.content, body).eq('Bad request: invalid freeze');
    }
    expect(game.frozen).is.false;
  });

  it('says when the change was not saved, and keeps it in memory', async () => {
    await start();
    game.persistTableState = () => Promise.resolve(false);

    await freeze(true);

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: The game is frozen, but that was not saved. A restart would undo it.');
    expect(game.frozen).is.true;

    await freeze(false);

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: The game runs again, but that was not saved. A restart would freeze it again.');
    expect(game.frozen).is.false;
  });

  it('holds the table lock in the step after it finds the game is still served', async () => {
    await start();
    let locked: boolean | undefined;
    const loader = scaffolding.ctx.gameLoader;
    const getGame = loader.getGame.bind(loader);
    let reads = 0;
    // A thenable: the callback runs in the first step after the awaiting request goes on.
    loader.getGame = (id) => ++reads === 1 ? getGame(id) : {
      then(resolve: (g: IGame | undefined) => void) {
        resolve(game);
        queueMicrotask(() => locked = isTableLocked(game.id));
      },
    } as unknown as Promise<IGame | undefined>;

    await freeze(true);

    expect(res.statusCode).eq(statusCode.ok);
    expect(locked).is.true;
  });

  it('refuses when the loader serves another object than the one the request took', async () => {
    await start();
    const [other] = testGame(2, {judgeLink: true, judgeUndo: true});
    const loader = scaffolding.ctx.gameLoader;
    const getGame = loader.getGame.bind(loader);
    let reads = 0;
    loader.getGame = (id) => ++reads === 1 ? getGame(id) : Promise.resolve(other);

    await freeze(true);

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: This game was rewound. Refresh this page.');
    expect(game.frozen).is.false;
  });
});
