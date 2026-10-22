import {expect} from 'chai';
import {ApiJudgeRewind} from '../../src/server/routes/ApiJudgeRewind';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {SerializedGame} from '../../src/server/SerializedGame';
import {GameLoader} from '../../src/server/database/GameLoader';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {clearReplayCache, getReplayMoves} from '../../src/server/replay/ReplayService';
import {isTableLocked, withTableLock} from '../../src/server/rewind/tableLock';
import {JudgeModel} from '../../src/common/models/JudgeModel';
import {Phase} from '../../src/common/Phase';
import {Timer} from '../../src/common/Timer';
import * as constants from '../../src/common/constants';
import {statusCode} from '../../src/common/http/statusCode';
import {cast} from '../../src/common/utils/utils';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {TestPlayer} from '../TestPlayer';
import {maxOutOceans, setOxygenLevel, setTemperature, testGame} from '../TestingUtils';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

const PASSWORD = '0123456789ab';

describe('ApiJudgeRewind', () => {
  let res: MockResponse;
  let db: SnapshotDatabase;
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;
  // The save before player 2's last action of the second generation, after player 1 moved.
  let target: number;

  function choose(p: IPlayer, title: string) {
    const action = cast(p.getWaitingFor(), OrOptions);
    p.process({type: 'or', index: action.options.findIndex((option) => option.title === title), response: {type: 'option'}});
  }

  // A two-player game played into the second generation's action phase.
  async function start(options: Parameters<typeof testGame>[1] = {}) {
    clearReplayCache();
    db = new SnapshotDatabase();
    setTestDatabase(db);
    [game, player, player2] = testGame(2, {judgeLink: true, judgeUndo: true, ...options});
    game.judgePassword = PASSWORD;
    await GameLoader.getInstance().add(game);
    game.phase = Phase.ACTION;
    player.heat = 40;
    player2.heat = 40;
    player.takeAction();
    choose(player, 'Pass for this generation');
    choose(player2, 'Pass for this generation');
    player.process({type: 'card', cards: []});
    player2.process({type: 'card', cards: []});
    // Player 2 goes first in the second generation.
    choose(player2, 'Convert 8 heat into temperature');
    choose(player2, 'Convert 8 heat into temperature');
    choose(player, 'Convert 8 heat into temperature');
    choose(player, 'Pass for this generation');
    target = game.lastSaveId - 1;
    choose(player2, 'Convert 8 heat into temperature');
  }

  // Mars is terraformed and nobody has plants, so player 2 passing after player 1 ends the game.
  async function finish() {
    setTemperature(game, constants.MAX_TEMPERATURE);
    setOxygenLevel(game, constants.MAX_OXYGEN_LEVEL);
    maxOutOceans(player);
    player.plants = 0;
    player2.plants = 0;
    choose(player2, 'Pass for this generation');
    await game.finishing;
    expect(game.phase).eq(Phase.END);
  }

  // The route reads the body off the 'data'/'end' events, so the body has to be emitted after
  // post() is called and the route has taken the game, but before post() is awaited. Each call gets a fresh request and response.
  // With `replacement`, the loader serves that object to every read after the first.
  async function post(body: string, options: {query?: string, id?: string, replacement?: IGame, onServed?: () => void} = {}) {
    const req = new MockRequest();
    res = new MockResponse();
    const scaffolding = new RouteTestScaffolding(req);
    const loader = scaffolding.ctx.gameLoader;
    await loader.add(game);
    if (options.replacement !== undefined) {
      const replacement = options.replacement;
      const getGame = loader.getGame.bind(loader);
      let reads = 0;
      loader.getGame = (id) => ++reads === 1 ? getGame(id) : Promise.resolve(replacement);
    }
    if (options.onServed !== undefined) {
      const onServed = options.onServed;
      const getGame = loader.getGame.bind(loader);
      let reads = 0;
      // A thenable: onServed runs in the first step after the awaiting request goes on.
      loader.getGame = (id) => ++reads === 1 ? getGame(id) : {
        then(resolve: (g: IGame | undefined) => void) {
          resolve(game);
          queueMicrotask(onServed);
        },
      } as unknown as Promise<IGame | undefined>;
    }
    scaffolding.url = `/api/judge/rewind?id=${options.id ?? game.judgeId}${options.query ?? '&password=' + PASSWORD}`;
    const response = scaffolding.post(ApiJudgeRewind.INSTANCE, res);
    const emit = new Promise((resolve) => setImmediate(resolve)).then(() => {
      req.emitString(body);
      req.emitter.emit('end');
    });
    await Promise.all([emit, response]);
  }

  const valid = () => JSON.stringify({saveId: target, cards: 'same', clocks: 'keep'});

  afterEach(() => {
    restoreTestDatabase();
    clearReplayCache();
  });

  it('rewinds the table, leaves it frozen, and answers the judge model of the restored game', async () => {
    await start();
    expect(game.frozen).is.false;

    await post(valid());

    expect(res.statusCode).eq(statusCode.ok);
    const restored = (await GameLoader.getInstance().getGame(game.id))!;
    expect(restored).is.not.eq(game);
    expect(restored.rewinds.map((rewind) => rewind.restoredSaveId)).deep.eq([target]);
    expect(restored.frozen).is.true;
    const model: JudgeModel = JSON.parse(res.content);
    expect(model.id).eq(game.judgeId);
    expect(model.game.frozen).is.true;
  });

  it('passes the judge\'s clocks and cards choices on, freezes the table, and the marker names the judge', async () => {
    for (const clocks of ['keep', 'back'] as const) {
      for (const cards of ['same', 'shuffle'] as const) {
        const label = `${clocks} ${cards}`;
        await start();
        const rows = db.games.get(game.id) as Array<SerializedGame>;
        const players = [player, player2];
        players.forEach((p, i) => {
          p.timer = Timer.deserialize({sumElapsed: 600_000 + i, startedAt: 0, running: false, afterFirstAction: true, lastStoppedAt: 0});
        });
        // Timers are not part of the moment's state, so the replay still matches the changed row.
        rows[target].players.forEach((p, i) => {
          p.timer.sumElapsed = 300_000 + i;
        });
        const saved = structuredClone(rows[target]);

        await post(JSON.stringify({saveId: target, cards, clocks}));

        expect(res.statusCode, label).eq(statusCode.ok);
        const restored = (await GameLoader.getInstance().getGame(game.id))!;
        expect(restored.frozen, label).is.true;
        // Back is the stored moment's clocks, keep is each player's live total.
        players.forEach((p, i) => {
          expect(restored.getPlayerById(p.id).timer.serialize().sumElapsed, label).eq((clocks === 'keep' ? 600_000 : 300_000) + i);
        });
        const drawPile = rows[rows.length - 1].projectDeck.drawPile;
        if (cards === 'same') {
          expect(drawPile, label).deep.eq(saved.projectDeck.drawPile);
        } else {
          expect(drawPile, label).not.deep.eq(saved.projectDeck.drawPile);
        }
        const marker = restored.gameLog[restored.gameLog.length - 1];
        expect(marker.message, label).eq('The judge rewound the game to generation ${0}' + (cards === 'shuffle' ? ' and shuffled the hidden piles' : ''));
        expect(marker.playerId, label).is.undefined;
      }
    }
  });

  it('reopens a finished game, frozen, and its moves are no longer a finished game\'s', async () => {
    await start();
    await finish();

    await post(valid());

    expect(res.statusCode).eq(statusCode.ok);
    const restored = (await GameLoader.getInstance().getGame(game.id))!;
    expect(restored.phase).is.not.eq(Phase.END);
    expect(restored.frozen).is.true;
    expect(await getReplayMoves(restored, restored.spectatorId)).deep.eq({status: 'not-finished'});
  });

  it('lets the serverId link rewind without claiming the judge seat', async () => {
    await start();
    game.judgePassword = undefined;

    await post(valid(), {query: '&serverId=1'});

    expect(res.statusCode).eq(statusCode.ok);
    expect(game.judgePassword).is.undefined;
  });

  it('refuses a game without judge undo, and a table whose lock is held', async () => {
    await start({judgeUndo: false});
    await post(valid());
    expect(res.statusCode).eq(statusCode.forbidden);
    expect(await GameLoader.getInstance().getGame(game.id)).eq(game);

    await start();
    let release = () => {};
    const held = withTableLock(game.id, () => new Promise<void>((resolve) => release = resolve));
    await post(valid());
    release();
    await held;
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: A rewind is already running.');
    expect(await GameLoader.getInstance().getGame(game.id)).eq(game);
  });

  it('refuses a player id, and a wrong or missing password on a claimed seat, in a running game and a finished one', async () => {
    await start();
    await post(valid(), {id: player.id});
    expect(res.statusCode).eq(statusCode.badRequest);

    for (const finished of [false, true]) {
      if (finished) {
        await finish();
      }
      for (const query of ['', '&password=deadbeef']) {
        await post(valid(), {query});
        expect(res.statusCode, `${finished} ${query}`).eq(statusCode.unauthorized);
      }
    }
    expect(await GameLoader.getInstance().getGame(game.id)).eq(game);
  });

  it('refuses a body that is not exactly a save id, a cards choice and a clocks choice', async () => {
    await start();
    const bodies: Array<string> = [
      {saveId: target, cards: 'same'},
      {saveId: target, cards: 'same', clocks: 'maybe'},
      {saveId: target, clocks: 'keep'},
      {cards: 'same', clocks: 'back'},
      {saveId: -1, cards: 'same', clocks: 'back'},
      {saveId: target, cards: 'same', clocks: 'keep', extra: true},
      [],
      null,
    ].map((body) => JSON.stringify(body));
    bodies.push('not json');
    for (const body of bodies) {
      await post(body);
      expect(res.statusCode, body).eq(statusCode.badRequest);
      expect(res.content, body).eq('Bad request: invalid rewind');
    }
    expect(await GameLoader.getInstance().getGame(game.id)).eq(game);
  });

  it('holds the table lock in the step after it finds the game is still served', async () => {
    await start();
    let locked: boolean | undefined;

    await post(valid(), {onServed: () => locked = isTableLocked(game.id)});

    expect(res.statusCode).eq(statusCode.ok);
    expect(locked).is.true;
  });

  it('refuses when the loader serves another object than the one the request took', async () => {
    await start();
    const [other] = testGame(2, {judgeLink: true, judgeUndo: true});

    await post(valid(), {replacement: other});

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: This game was rewound. Refresh this page.');
    expect(await GameLoader.getInstance().getGame(game.id)).eq(game);
  });
});
