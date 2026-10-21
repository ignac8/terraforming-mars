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

  it('the serverId link does not claim the password', async () => {
    // scaffolding sets serverId to '1'
    const model = await getJudge('&serverId=1');

    expect(model.id).eq(game.judgeId);
    expect(game.judgePassword).is.undefined;
  });

  it('an unclaimed seat is claimed with a well-formed password the request carries', async () => {
    const mine = '0123456789ab';

    const model = await getJudge('&password=' + mine);

    expect(game.judgePassword).eq(mine);
    expect(model.password).eq(mine);
  });

  it('an unclaimed seat ignores a malformed password and hands out a fresh one', async () => {
    for (const malformed of ['', '0123456789a', '0123456789abc', 'ghijklmnopqr', '0123456789AB']) {
      game.judgePassword = undefined;

      const model = await getJudge('&password=' + malformed);

      expect(model.password).is.not.eq(malformed);
      expect(game.judgePassword).eq(model.password);
      expect(game.judgePassword).matches(/^[0-9a-f]{12}$/);
    }
  });

  it('a later visitor without the password is refused', async () => {
    await getJudge('');

    await expectUnauthorized('');
  });

  it('a later visitor with the wrong password is refused', async () => {
    await getJudge('');

    await expectUnauthorized('&password=deadbeef');
  });

  it('a wrong password of the same length is refused', async () => {
    const model = await getJudge('');
    const stored = model.password!;
    const lastDigit = stored.charAt(stored.length - 1);
    const wrong = stored.slice(0, -1) + (lastDigit === '0' ? '1' : '0');
    expect(wrong).has.length(stored.length);

    await expectUnauthorized('&password=' + wrong);
  });

  it('an empty password is refused', async () => {
    await getJudge('');

    await expectUnauthorized('&password=');
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
    const solo = TestPlayer.GREEN.newPlayer();
    game = Game.newInstance('gsolo', [solo], solo, 'solospectator', {judgeLink: true});
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
    const first = TestPlayer.GREEN.newPlayer();
    const second = TestPlayer.RED.newPlayer();
    game = Game.newInstance('gnopw', [first, second], first, 'snopw', {judgeLink: true, playerPasswords: false});
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
