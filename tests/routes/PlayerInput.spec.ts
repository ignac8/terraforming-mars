import {expect} from 'chai';
import {PlayerInput, playerInputMetrics} from '../../src/server/routes/PlayerInput';
import {MockRequest, MockResponse} from './HttpMocks';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {UndoActionOption} from '../../src/server/inputs/UndoActionOption';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {cast} from '@/common/utils/utils';
import {OrOptionsResponse} from '../../src/common/inputs/InputResponse';
import {CardName} from '../../src/common/cards/CardName';
import {Payment} from '../../src/common/inputs/Payment';
import {statusCode} from '@/common/http/statusCode';
import {FakeClock} from '../common/FakeClock';
import {INVALID_REQUEST_ID, RESPONDING_TOO_QUICKLY} from '@/common/app/AppErrorId';
import {rewindGame} from '../../src/server/rewind/RewindService';
import {stateHash} from '../../src/server/rewind/stateHash';
import {isTableLocked, withTableLock} from '../../src/server/rewind/tableLock';
import {RouteError} from '../../src/server/routes/RouteError';
import {clearReplayCache} from '../../src/server/replay/ReplayService';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {testGame} from '../TestGame';
import {Phase} from '../../src/common/Phase';
import {GameLoader} from '../../src/server/database/GameLoader';

describe('PlayerInput', () => {
  let scaffolding: RouteTestScaffolding;
  let req: MockRequest;
  let res: MockResponse;

  beforeEach(() => {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
  });

  /**
   * POSTs `body` to `handler` as input from `playerId`, and waits for the response.
   *
   * Replaces `req` and `res` with fresh mocks, so after this returns, `res` holds this request's response.
   */
  async function send(handler: PlayerInput, playerId: string, body: string): Promise<void> {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding.req = req;
    scaffolding.url = `/player/input?id=${playerId}`;
    const post = scaffolding.post(handler, res);
    const emit = Promise.resolve().then(() => {
      req.emitString(body);
      req.emitter.emit('end');
    });
    await Promise.all([emit, post]);
  }

  it('fails when id not provided', async () => {
    scaffolding.url = '/player/input';
    await scaffolding.post(PlayerInput.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('performs undo action', async () => {
    const player = TestPlayer.BLUE.newPlayer({beginner: true});
    scaffolding.url = '/player/input?id=' + player.id;
    const game = Game.newInstance('gameid-foo', [player], player, 'spectatorid');

    const undoVersionOfPlayer = TestPlayer.BLUE.newPlayer({beginner: true});
    const undo = Game.newInstance('gameid-old', [undoVersionOfPlayer], undoVersionOfPlayer, 'spectatorid');

    await scaffolding.ctx.gameLoader.add(game);

    player.process({type: 'or', index: 1, response: {type: 'projectCard', card: CardName.POWER_PLANT_STANDARD_PROJECT, payment: Payment.of({megacredits: 11})}});
    const options = cast(player.getWaitingFor(), OrOptions);
    options.options.push(new UndoActionOption());
    scaffolding.ctx.gameLoader.restoreGameAt = (_gameId: string, _lastSaveId: number) => Promise.resolve(undo);

    const post = scaffolding.post(PlayerInput.INSTANCE, res);
    const emit = Promise.resolve().then(() => {
      const orOptionsResponse: OrOptionsResponse = {type: 'or', index: options.options.length - 1, response: {type: 'option'}};
      req.emitString(JSON.stringify(orOptionsResponse));
      req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));

    const model = JSON.parse(res.content);
    expect(game.gameAge).not.eq(undo.gameAge);
    expect(model.game.gameAge).eq(undo.gameAge);
  });

  it('reverts to current game instance if undo fails', async () => {
    const player = TestPlayer.BLUE.newPlayer({beginner: true});
    scaffolding.url = '/player/input?id=' + player.id;
    const game = Game.newInstance('gameid-foo', [player], player, 'spectatorid');

    const undoVersionOfPlayer = TestPlayer.BLUE.newPlayer({beginner: true});
    const undo = Game.newInstance('gameid-old', [undoVersionOfPlayer], undoVersionOfPlayer, 'spectatorid');

    await scaffolding.ctx.gameLoader.add(game);

    player.process(<OrOptionsResponse>{type: 'or', index: 1, response: {type: 'projectCard', card: CardName.POWER_PLANT_STANDARD_PROJECT, payment: Payment.of({megacredits: 11})}});
    const options = cast(player.getWaitingFor(), OrOptions);
    options.options.push(new UndoActionOption());
    scaffolding.ctx.gameLoader.restoreGameAt = (_gameId: string, _lastSaveId: number) => Promise.reject(new Error('error'));

    const post = scaffolding.post(PlayerInput.INSTANCE, res);
    const emit = Promise.resolve().then(() => {
      const orOptionsResponse: OrOptionsResponse = {type: 'or', index: options.options.length - 1, response: {type: 'option'}};
      scaffolding.req.emitString(JSON.stringify(orOptionsResponse));
      scaffolding.req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));

    const model = JSON.parse(res.content);
    expect(game.gameAge).not.eq(undo.gameAge);
    expect(model.game.gameAge).eq(model.game.gameAge);
  });

  it('holds the table while it undoes', async () => {
    const [game, player] = testGame(1, {undoOption: true});
    await scaffolding.ctx.gameLoader.add(game);
    player.takeAction();
    const options = cast(player.getWaitingFor(), OrOptions);
    options.options.push(new UndoActionOption());
    let reached = () => {};
    const atUndo = new Promise<void>((resolve) => reached = resolve);
    let release = () => {};
    scaffolding.ctx.gameLoader.restoreGameAt = () => {
      reached();
      return new Promise((resolve) => release = () => resolve(game));
    };

    const undoing = send(PlayerInput.INSTANCE, player.id, JSON.stringify({type: 'or', index: options.options.length - 1, response: {type: 'option'}}));
    await atUndo;
    try {
      expect(isTableLocked(game.id)).is.true;
      let refused: unknown;
      await rewindGame(game, player, 0, 'same').catch((e) => refused = e);
      expect(cast(refused, RouteError).detail).eq('A rewind is already running.');
    } finally {
      release();
      await undoing;
    }

    expect(res.statusCode).eq(statusCode.ok);
    expect(isTableLocked(game.id)).is.false;
  });

  it('sends 400 when input processing throws a plain Error', async () => {
    const player = TestPlayer.BLUE.newPlayer({beginner: true});
    scaffolding.url = '/player/input?id=' + player.id;
    const game = Game.newInstance('gameid-foo', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);

    const options = cast(player.getWaitingFor(), OrOptions);
    options.options.push(new SelectOption('Throw').andThen(() => {
      throw new Error('You cannot overspend heat');
    }));

    const post = scaffolding.post(PlayerInput.INSTANCE, res);
    const emit = Promise.resolve().then(() => {
      const orOptionsResponse: OrOptionsResponse = {type: 'or', index: options.options.length - 1, response: {type: 'option'}};
      req.emitString(JSON.stringify(orOptionsResponse));
      req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(JSON.parse(res.content)).deep.eq({message: 'You cannot overspend heat'});
  });

  it('sends 400 on server error', async () => {
    const player = TestPlayer.BLUE.newPlayer();
    scaffolding.url = `/player/input?id=${player.id}`;
    const game = Game.newInstance('gameid', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);

    const post = scaffolding.post(PlayerInput.INSTANCE, res);
    const emit = Promise.resolve().then(() => {
      scaffolding.req.emitString('}{');
      scaffolding.req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).matches(/Unexpected token/);
  });

  it('rejects a response to an earlier input', async () => {
    const player = TestPlayer.BLUE.newPlayer({beginner: true});
    scaffolding.url = `/player/input?id=${player.id}`;
    const game = Game.newInstance('gameid', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    const waitingFor = player.getWaitingFor();
    const powerPlant: OrOptionsResponse = {type: 'or', index: 1, response: {type: 'projectCard', card: CardName.POWER_PLANT_STANDARD_PROJECT, payment: Payment.of({megacredits: 11})}};

    const post = scaffolding.post(PlayerInput.INSTANCE, res);
    const emit = Promise.resolve().then(() => {
      scaffolding.req.emitString(JSON.stringify({requestId: 'earlier', ...powerPlant}));
      scaffolding.req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(JSON.parse(res.content).id).eq(INVALID_REQUEST_ID);
    expect(player.getWaitingFor()).eq(waitingFor);
  });

  describe('response interval', () => {
    let clock: FakeClock;
    let player: TestPlayer;

    beforeEach(async () => {
      clock = scaffolding.ctx.clock as FakeClock;
      player = TestPlayer.BLUE.newPlayer({beginner: true});
      player.clock = clock;
      const game = Game.newInstance('gameid', [player], player, 'spectatorid');
      await scaffolding.ctx.gameLoader.add(game);
      playerInputMetrics.responseInterval.reset();
    });

    it('rejects input sent before the interval elapses', async () => {
      const handler = new PlayerInput(1000);
      player.inputRequestedAt = 5000;
      clock.millis = 5999;

      await send(handler, player.id, '}{');
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(JSON.parse(res.content).id).eq(RESPONDING_TOO_QUICKLY);
    });

    it('a rejected input does not restart the interval', async () => {
      const handler = new PlayerInput(1000);
      player.inputRequestedAt = 5000;
      clock.millis = 5999;

      await send(handler, player.id, '}{');
      expect(JSON.parse(res.content).id).eq(RESPONDING_TOO_QUICKLY);

      clock.millis = 6000;
      await send(handler, player.id, '}{');
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(JSON.parse(res.content).id).is.undefined;
    });

    it('processing an input restarts the interval', async () => {
      const handler = new PlayerInput(1000);
      player.inputRequestedAt = 5000;
      clock.millis = 6000;

      const response: OrOptionsResponse = {type: 'or', index: 1, response: {type: 'projectCard', card: CardName.POWER_PLANT_STANDARD_PROJECT, payment: Payment.of({megacredits: 11})}};
      await send(handler, player.id, JSON.stringify(response));
      expect(res.statusCode).eq(statusCode.ok);

      clock.millis = 6999;

      await send(handler, player.id, '}{');
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(JSON.parse(res.content).id).eq(RESPONDING_TOO_QUICKLY);
    });

    it('does not limit input when the response interval is zero', async () => {
      const handler = new PlayerInput(0);

      await send(handler, player.id, '}{');
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(JSON.parse(res.content).id).is.undefined;
    });

    it('records the time taken to respond to an input request', async () => {
      const handler = new PlayerInput(0);
      player.inputRequestedAt = 5000;
      clock.millis = 5300;

      await send(handler, player.id, '}{');

      const values = (await playerInputMetrics.responseInterval.get()).values;
      expect(values.find((v) => v.metricName === 'player_input_response_interval_count')?.value).eq(1);
      expect(values.find((v) => v.metricName === 'player_input_response_interval_sum')?.value).eq(300);
    });
  });

  it('refuses an input on a game a rewind replaced', async () => {
    const db = new SnapshotDatabase();
    setTestDatabase(db);
    try {
      clearReplayCache();
      const [game, player] = testGame(1, {undoOption: true});
      // The route took this object before the rewind replaced it.
      await scaffolding.ctx.gameLoader.add(game);
      // The rewind replaces the object that the game loader serves.
      await GameLoader.getInstance().add(game);
      player.takeAction();
      const pass = (): OrOptionsResponse => {
        const index = cast(player.getWaitingFor(), OrOptions).options.findIndex((option) => option.title === 'Pass for this generation');
        return {type: 'or', index, response: {type: 'option'}};
      };
      player.process(pass());
      const research = game.lastSaveId - 1;
      player.process({type: 'card', cards: []});
      const requestId = player.requestId;
      await rewindGame(game, player, research, 'same');
      const saves = db.games.get(game.id)!.length;

      await send(PlayerInput.INSTANCE, player.id, JSON.stringify({requestId, ...pass()}));

      expect(res.statusCode).eq(statusCode.badRequest);
      expect(JSON.parse(res.content).id).eq(INVALID_REQUEST_ID);
      expect(db.games.get(game.id)!).has.length(saves);
    } finally {
      restoreTestDatabase();
    }
  });

  it('refuses an answer while the game is frozen or its table is locked, and changes nothing', async () => {
    for (const hold of ['frozen', 'locked'] as const) {
      const db = new SnapshotDatabase();
      setTestDatabase(db);
      let release = () => {};
      let locked: Promise<void> | undefined;
      try {
        const [game, player] = testGame(2);
        await scaffolding.ctx.gameLoader.add(game);
        game.phase = Phase.ACTION;
        player.takeAction();
        const index = cast(player.getWaitingFor(), OrOptions).options.findIndex((option) => option.title === 'Pass for this generation');
        const requestId = player.requestId;
        if (hold === 'frozen') {
          game.frozen = true;
        } else {
          locked = withTableLock(game.id, () => new Promise((resolve) => release = resolve));
        }
        const inputs = structuredClone(game.inputsSinceSave);
        const hash = stateHash(game.serialize());
        const saves = db.games.get(game.id)?.length ?? 0;

        await send(PlayerInput.INSTANCE, player.id, JSON.stringify({requestId, type: 'or', index, response: {type: 'option'}}));

        expect(res.statusCode, hold).eq(statusCode.badRequest);
        expect(JSON.parse(res.content).id, hold).eq(INVALID_REQUEST_ID);
        expect(game.inputsSinceSave, hold).deep.eq(inputs);
        expect(stateHash(game.serialize()), hold).eq(hash);
        expect(db.games.get(game.id)?.length ?? 0, hold).eq(saves);
      } finally {
        release();
        await locked;
        restoreTestDatabase();
      }
    }
  });
});
