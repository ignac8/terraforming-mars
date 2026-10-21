import {expect} from 'chai';
import {ApiJudge} from '../../src/server/routes/ApiJudge';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {JudgeModel} from '../../src/common/models/JudgeModel';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '@/common/http/statusCode';
import {Phase} from '../../src/common/Phase';

describe('judge passwords', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(async () => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
    player = TestPlayer.BLACK.newPlayer();
    opponent = TestPlayer.BLUE.newPlayer();
    game = Game.newInstance('gameid', [player, opponent], player, 'spectatorid', {judgeLink: true});
    await scaffolding.ctx.gameLoader.add(game);
  });

  /** Fetches the judge model, returning it parsed. Fails the test on a non-200. */
  async function getJudge(query: string): Promise<JudgeModel> {
    const response = new MockResponse();
    scaffolding.url = '/api/judge?id=' + game.judgeId + query;
    await scaffolding.get(ApiJudge.INSTANCE, response);
    expect(response.statusCode).eq(statusCode.ok);
    return JSON.parse(response.content);
  }

  async function expectUnauthorized(query: string) {
    const response = new MockResponse();
    scaffolding.url = '/api/judge?id=' + game.judgeId + query;
    await scaffolding.get(ApiJudge.INSTANCE, response);
    expect(response.statusCode).eq(statusCode.unauthorized);
  }

  it('the first visitor claims the judge password and is handed it', async () => {
    expect(game.judgePassword).is.undefined;

    const model = await getJudge('');

    expect(game.judgePassword).is.not.undefined;
    expect(model.password).eq(game.judgePassword);
  });

  it('a later visitor without the password is refused', async () => {
    await getJudge('');

    await expectUnauthorized('');
  });

  it('a later visitor with the wrong password is refused', async () => {
    await getJudge('');

    await expectUnauthorized('&password=deadbeef');
  });

  it('the claimant keeps access with the password', async () => {
    const model = await getJudge('');

    const second = await getJudge('&password=' + model.password);

    expect(second.id).eq(game.judgeId);
  });

  it('the serverId link still gets through', async () => {
    await getJudge('');

    // scaffolding sets serverId to '1'
    const model = await getJudge('&serverId=1');

    expect(model.id).eq(game.judgeId);
  });

  it('a solo game still requires the password', async () => {
    game = Game.newInstance('gsolo', [player], player, 'solospectator', {judgeLink: true});
    await scaffolding.ctx.gameLoader.add(game);
    expect(game.isSoloMode()).is.true;
    await getJudge('');

    await expectUnauthorized('');
  });

  it('a finished game still requires the password', async () => {
    await getJudge('');
    game.phase = Phase.END;

    await expectUnauthorized('');
  });

  it('requires the password when playerPasswords is off', async () => {
    game = Game.newInstance('gnopw', [player, opponent], player, 'snopw', {judgeLink: true, playerPasswords: false});
    await scaffolding.ctx.gameLoader.add(game);
    await getJudge('');

    await expectUnauthorized('');
  });

  it('judge requests never claim a player seat', async () => {
    const model = await getJudge('');
    await getJudge('&password=' + model.password);

    expect(player.password).is.undefined;
    expect(opponent.password).is.undefined;
  });

  it('an unknown judge id is not found', async () => {
    scaffolding.url = '/api/judge?id=jdoesnotexist';
    await scaffolding.get(ApiJudge.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('a judge id that does not belong to the loaded game is not found', async () => {
    // A loader that resolves any id to this game: the route must still compare ids.
    scaffolding.ctx.gameLoader.getGame = () => Promise.resolve(game);
    scaffolding.url = '/api/judge?id=jsomeoneelse';
    await scaffolding.get(ApiJudge.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.notFound);
    expect(game.judgePassword).is.undefined;
  });

  it('a spectator id is a bad request', async () => {
    scaffolding.url = '/api/judge?id=spectatorid';
    await scaffolding.get(ApiJudge.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.badRequest);
  });

  it('a player id is a bad request', async () => {
    scaffolding.url = '/api/judge?id=' + player.id;
    await scaffolding.get(ApiJudge.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.badRequest);
  });
});
