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
import {Phase} from '@/common/Phase';
import {GameLogs} from '@/server/routes/GameLogs';
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

  it('pulls a generation from a log with holes', async () => {
    const [game, player] = testGame(1);
    await scaffolding.ctx.gameLoader.add(game);
    game.gameLog.length = 0;
    game.log('Generation ${0}', (b) => b.forNewGeneration().number(1));
    game.gameLog.length = 2;
    game.log('After the hole');

    scaffolding.url = '/api/game/logs?id=' + player.id + '&generation=1';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content).map((m: {message: string}) => m.message)).deep.eq(['Generation ${0}', 'After the hole']);
  });

  it('pulls logs for missing generation', async () => {
    const [game, player] = testGame(1);
    scaffolding.url = '/api/game/logs?id=' + player.id + '&generation=2';
    await scaffolding.ctx.gameLoader.add(game);
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);
    expect(messages).is.empty;
  });

  for (const query of ['', '&generation=1']) {
    for (const viewer of ['player', 'spectator'] as const) {
      it(`hides the abandoned lines of a rewind from the ${viewer}${query}`, async () => {
        const [game, player] = testGame(1);
        await scaffolding.ctx.gameLoader.add(game);
        game.gameLog.length = 0;
        for (let i = 0; i < 5; i++) {
          game.log(`Log ${i}`);
        }
        game.rewinds = [{saveId: 3, restoredSaveId: 1, logStart: 1, logEnd: 3}];

        scaffolding.url = '/api/game/logs?id=' + (viewer === 'spectator' ? game.spectatorId : player.id) + query;
        await scaffolding.get(ApiGameLogs.INSTANCE, res);
        expect(JSON.parse(res.content).map((m: {message: string}) => m.message)).deep.eq(['Log 0', 'Log 3', 'Log 4']);
      });
    }
  }

  it('hides the abandoned lines of a rewind from the end of game log', () => {
    const [game] = testGame(1);
    game.gameLog.length = 0;
    for (let i = 0; i < 5; i++) {
      game.log(`Log ${i}`);
    }
    game.rewinds = [{saveId: 3, restoredSaveId: 1, logStart: 1, logEnd: 3}];
    game.phase = Phase.END;

    expect(new GameLogs().getLogsForGameEnd(game)).deep.eq(['Log 0', 'Log 3', 'Log 4']);
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

  describe('the lines a rewind hid', () => {
    // A rewind of a game that was in generation 2 hid lines 2 and 3, which started generation 3.
    async function rewound() {
      const [game, first] = testGame(2, {undoOption: true});
      await scaffolding.ctx.gameLoader.add(game);
      game.gameLog.length = 0;
      game.log('Generation ${0}', (b) => b.forNewGeneration().number(2));
      game.log('Line 1');
      game.log('Generation ${0}', (b) => b.forNewGeneration().number(3));
      game.log('Line 3');
      game.log('Rewound');
      game.log('Line 5');
      game.rewinds = [{saveId: 3, restoredSaveId: 1, logStart: 2, logEnd: 4}];
      return {game, first};
    }

    async function read(query: string) {
      res = new MockResponse();
      scaffolding.url = '/api/game/logs?' + query;
      await scaffolding.get(ApiGameLogs.INSTANCE, res);
    }

    const texts = (): Array<string> => JSON.parse(res.content).map((m: {message: string}) => m.message);

    it('hides them from a player and a spectator, also in the generation they would have started', async () => {
      const {game, first} = await rewound();
      for (const viewer of [first.id, game.spectatorId]) {
        for (const generation of ['', '&generation=2']) {
          await read(`id=${viewer}${generation}`);
          expect(res.statusCode, viewer + generation).eq(statusCode.ok);
          expect(texts(), viewer + generation).deep.eq(['Generation ${0}', 'Line 1', 'Rewound', 'Line 5']);
        }
        await read(`id=${viewer}&generation=3`);
        expect(texts(), viewer).is.empty;
      }
    });
  });
});
