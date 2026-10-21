import {expect} from 'chai';
import {ApiGameLogs} from '../../src/server/routes/ApiGameLogs';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {testGame} from '@tests/TestGame';
import {statusCode} from '@/common/http/statusCode';
use(chaiAsPromised);

describe('ApiGameLogs', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  it('fails when id not provided', async () => {
    scaffolding.url = '/api/game/logs';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails with invalid id', async () => {
    scaffolding.url = '/api/game/logs?id=game-id';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: invalid participant id');
  });

  it('fails when game not found', async () => {
    scaffolding.url = '/api/game/logs?id=player-invalid-id';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found: game not found');
  });

  it('pulls logs when no generation provided', async () => {
    const [game, player] = testGame(1);
    scaffolding.url = '/api/game/logs?id=' + player.id;
    await scaffolding.ctx.gameLoader.add(game);
    game.log('Generation ${0}', (b) => b.forNewGeneration().number(50));
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);
    expect(messages.length).gt(1);
    expect(messages[messages.length - 1].message).eq('Generation ${0}');
    expect(messages[messages.length - 1].data[0].value).eq('50');
  });

  it('pulls logs for most recent generation', async () => {
    const [game, player] = testGame(1);
    scaffolding.url = '/api/game/logs?id=' + player.id + '&generation=50';
    await scaffolding.ctx.gameLoader.add(game);
    game.log('Generation ${0}', (b) => b.forNewGeneration().number(50));
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);
    expect(messages).has.length(1);
    expect(messages[messages.length - 1].message).eq('Generation ${0}');
    expect(messages[messages.length - 1].data[0].value).eq('50');
  });

  it('pulls full current generation when explicitly requested', async () => {
    const [game, player] = testGame(1);
    await scaffolding.ctx.gameLoader.add(game);

    game.gameLog.length = 0;
    game.log('Generation ${0}', (b) => b.forNewGeneration().number(1));
    for (let i = 0; i < 60; i++) {
      game.log(`Log ${i}`);
    }

    scaffolding.url = '/api/game/logs?id=' + player.id + '&generation=1';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);

    expect(messages).has.length(61);
    expect(messages[0].message).eq('Generation ${0}');
    expect(messages[messages.length - 1].message).eq('Log 59');
  });

  it('pulls logs for first generation', async () => {
    const [game, player] = testGame(1);
    scaffolding.url = '/api/game/logs?id=' + player.id;
    await scaffolding.ctx.gameLoader.add(game);
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);
    expect(messages.length).gt(1);
    expect(messages[messages.length - 1].message).eq('Generation ${0}');
    expect(messages[messages.length - 1].data[0].value).eq('1');
  });

  it('pulls logs for missing generation', async () => {
    const [game, player] = testGame(1);
    scaffolding.url = '/api/game/logs?id=' + player.id + '&generation=2';
    await scaffolding.ctx.gameLoader.add(game);
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);
    expect(messages).is.empty;
  });

  [{idx: 0, color: 'Yellow'}, {idx: 1, color: 'Orange'}, {idx: 2, color: 'Blue'}].forEach((entry) => {
    it('omits private logs for other players: ' + entry.color, async () => {
      const yellowPlayer = TestPlayer.YELLOW.newPlayer();
      const orangePlayer = TestPlayer.ORANGE.newPlayer();
      const bluePlayer = TestPlayer.BLUE.newPlayer();

      const players = [yellowPlayer, orangePlayer, bluePlayer];
      const playerUnderTest = players[entry.idx];

      const game = Game.newInstance('game-id', players, yellowPlayer, 'spectatorid');
      await scaffolding.ctx.gameLoader.add(game);

      // Remove logs to-date to simplify the test
      game.gameLog.length = 0;
      game.log('All players see this.');
      game.log('Yellow player sees this.', (_b) => {}, {reservedFor: yellowPlayer});
      game.log('Orange player sees this.', (_b) => {}, {reservedFor: orangePlayer});
      game.log('Blue player sees this.', (_b) => {}, {reservedFor: bluePlayer});

      scaffolding.url = '/api/game/logs?id=' + playerUnderTest.id;
      await scaffolding.get(ApiGameLogs.INSTANCE, res);
      const messages = JSON.parse(res.content);

      expect(messages).has.length(2);
      expect(messages[0].message).eq('All players see this.');
      expect(messages[1].message).eq(`${entry.color} player sees this.`);
    });
  });

  it('judge logs include private lines tagged with their owner', async () => {
    const yellowPlayer = TestPlayer.YELLOW.newPlayer();
    const orangePlayer = TestPlayer.ORANGE.newPlayer();
    const game = Game.newInstance('game-id', [yellowPlayer, orangePlayer], yellowPlayer, 'spectatorid', {judgeLink: true});
    await scaffolding.ctx.gameLoader.add(game);

    game.gameLog.length = 0;
    game.log('All players see this.');
    game.log('Yellow only.', (_b) => {}, {reservedFor: yellowPlayer});
    game.log('Orange only.', (_b) => {}, {reservedFor: orangePlayer});

    scaffolding.url = '/api/game/logs?id=' + game.judgeId;
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);

    expect(messages.map((m: any) => m.message)).deep.eq(['All players see this.', 'Yellow only.', 'Orange only.']);
    expect(messages.map((m: any) => m.owner)).deep.eq([undefined, yellowPlayer.color, orangePlayer.color]);
    expect(messages.filter((m: any) => m.playerId !== undefined)).is.empty;
    // The stored log keeps its player ids.
    expect(game.gameLog.map((m) => m.playerId)).deep.eq([undefined, yellowPlayer.id, orangePlayer.id]);
  });

  it('judge logs refuse a wrong password once the judge password is claimed', async () => {
    const yellowPlayer = TestPlayer.YELLOW.newPlayer();
    const orangePlayer = TestPlayer.ORANGE.newPlayer();
    const game = Game.newInstance('game-id', [yellowPlayer, orangePlayer], yellowPlayer, 'spectatorid', {judgeLink: true});
    game.judgePassword = 'secret';
    await scaffolding.ctx.gameLoader.add(game);

    scaffolding.url = '/api/game/logs?id=' + game.judgeId + '&password=wrong';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.unauthorized);
  });
});
