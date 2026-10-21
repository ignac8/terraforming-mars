import {expect} from 'chai';
import {ApiReplayMoves} from '../../src/server/routes/ApiReplayMoves';
import {IGame} from '../../src/server/IGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {clearReplayCache} from '../../src/server/replay/ReplayService';
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

  it('says not-finished for a running game', async () => {
    scaffolding.url = '/api/replay/moves?id=' + player.id;
    await scaffolding.get(ApiReplayMoves.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content)).deep.eq({status: 'not-finished'});
  });
});
