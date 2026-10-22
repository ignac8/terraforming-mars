import {expect} from 'chai';
import {ApiRewind} from '../../src/server/routes/ApiRewind';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {GameLoader} from '../../src/server/database/GameLoader';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {clearReplayCache} from '../../src/server/replay/ReplayService';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {statusCode} from '../../src/common/http/statusCode';
import {Phase} from '../../src/common/Phase';
import {cast} from '../../src/common/utils/utils';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestingUtils';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiRewind', () => {
  let req: MockRequest;
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;
  let game: IGame;
  let player: TestPlayer;
  // The save of the action prompt after two heat conversions.
  let convert: number;

  function choose(p: IPlayer, title: string) {
    const action = cast(p.getWaitingFor(), OrOptions);
    p.process({type: 'or', index: action.options.findIndex((option) => option.title === title), response: {type: 'option'}});
  }

  async function start(playerCount: 1 | 2, options: Parameters<typeof testGame>[1] = {}) {
    clearReplayCache();
    setTestDatabase(new SnapshotDatabase());
    [game, player] = testGame(playerCount, {undoOption: true, ...options});
    await GameLoader.getInstance().add(game);
    await scaffolding.ctx.gameLoader.add(game);
  }

  // The route reads the body off the 'data'/'end' events, so the body has to be emitted after
  // post() is called but before it is awaited. Each call gets a fresh request and response.
  async function post(body: string, query = '', id: string = player.id) {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    await scaffolding.ctx.gameLoader.add(game);
    scaffolding.url = `/api/rewind?id=${id}${query}`;
    const response = scaffolding.post(ApiRewind.INSTANCE, res);
    const emit = Promise.resolve().then(() => {
      req.emitString(body);
      req.emitter.emit('end');
    });
    await Promise.all([emit, response]);
  }

  beforeEach(() => {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
  });

  afterEach(() => {
    restoreTestDatabase();
    clearReplayCache();
  });

  describe('solo game with undo', () => {
    beforeEach(async () => {
      await start(1);
      player.heat = 40;
      player.takeAction();
      choose(player, 'Pass for this generation');
      player.process({type: 'card', cards: []});
      choose(player, 'Convert 8 heat into temperature');
      choose(player, 'Convert 8 heat into temperature');
      convert = game.lastSaveId - 1;
      choose(player, 'Pass for this generation');
    });

    it('rewinds the game and answers the view of the restored player', async () => {
      await post(JSON.stringify({saveId: convert, cards: 'same'}));

      expect(res.statusCode).eq(statusCode.ok);
      const view: PlayerViewModel = JSON.parse(res.content);
      expect(view.id).eq(player.id);
      const restored = await GameLoader.getInstance().getGame(game.id);
      expect(restored).is.not.eq(game);
      expect(restored?.rewinds.map((rewind) => rewind.restoredSaveId)).deep.eq([convert]);
      expect(view.game.undoCount).eq(game.undoCount + 1);
    });

    it('refuses the spectator id of a finished game', async () => {
      game.phase = Phase.END;

      await post(JSON.stringify({saveId: convert, cards: 'same'}), '', game.spectatorId);

      expect(res.statusCode).eq(statusCode.badRequest);
      expect(res.content).eq('Bad request: invalid player id');
      expect((await GameLoader.getInstance().getGame(game.id))).eq(game);
    });

    it('passes the refusal of the service through, with its reason', async () => {
      await post(JSON.stringify({saveId: 9999, cards: 'same'}));

      expect(res.statusCode).eq(statusCode.notFound);
      expect(res.content).eq('Not found: That move is not in this game\'s history.');
    });

    it('refuses a body that is not exactly a save id and a cards choice', async () => {
      const bodies: Array<string> = [
        {saveId: convert, cards: 'maybe'},
        {saveId: convert},
        {cards: 'same'},
        {saveId: -1, cards: 'same'},
        {saveId: 1.5, cards: 'same'},
        {saveId: String(convert), cards: 'same'},
        {saveId: convert, cards: 'same', extra: true},
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

    it('answers 404 for an unknown player', async () => {
      scaffolding.url = '/api/rewind?id=p-unknown';
      await scaffolding.post(ApiRewind.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.notFound);
    });
  });

  describe('two-player game with undo', () => {
    beforeEach(() => start(2));

    it('is refused', async () => {
      await post(JSON.stringify({saveId: 1, cards: 'same'}));

      expect(res.statusCode).eq(statusCode.forbidden);
    });
  });

  describe('with player passwords', () => {
    // The seat check runs before the rewind service, which refuses a two-player game with a 403.
    // So a bad password is told apart from a good one by 401 against 403.
    beforeEach(async () => {
      await start(2, {playerPasswords: true});
      player.password = '0123456789ab';
    });

    it('refuses a missing or wrong password, and lets the right one through to the service', async () => {
      for (const [query, expected] of [
        ['', statusCode.unauthorized],
        ['&password=deadbeef', statusCode.unauthorized],
        ['&password=0123456789ab', statusCode.forbidden],
      ] as const) {
        await post(JSON.stringify({saveId: 1, cards: 'same'}), query);
        expect(res.statusCode, query).eq(expected);
      }
    });
  });
});
