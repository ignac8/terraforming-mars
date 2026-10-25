import {expect} from 'chai';
import {ApiWaitingFor} from '../../src/server/routes/ApiWaitingFor';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {GameId} from '../../src/common/Types';
import {statusCode} from '../../src/common/http/statusCode';
import {testGame} from '../TestGame';
import {SelectOption} from '../../src/server/inputs/SelectOption';

describe('ApiWaitingFor', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  it('fails when id is missing', async () => {
    scaffolding.url = '/api/waitingfor?gameAge=123&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails when game not found', async () => {
    scaffolding.url = '/api/waitingfor?id=p-some-player-id&gameAge=123&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found: cannot find game for that player');
  });

  it('fails when player not found', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('g' + player.id as GameId, [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    (game as any).getPlayerById = () => {
      throw new Error('player does not exist');
    };

    scaffolding.url = '/api/waitingfor?id=' + player.id + '&gameAge=50&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found: player not found');
  });

  it('sends model for player', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);

    scaffolding.url = '/api/waitingfor?id=' + player.id + '&gameAge=50&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(res.content).eq('{"result":"GO","waitingFor":["black"]}');
  });

  it('fails when spectator not found', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const player2 = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-id', [player, player2], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    (game as any).getBySpectatorId = () => {
      throw new Error('spectator does not exist');
    };

    scaffolding.url = '/api/waitingfor?id=' + game.spectatorId + '-invalid' + '&gameAge=50&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found: cannot find game for that player');
  });

  it('sends model for spectator', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const player2 = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-id', [player, player2], player, 's-spectatorid');
    await scaffolding.ctx.gameLoader.add(game);

    scaffolding.url = '/api/waitingfor?id=' + game.spectatorId + '&gameAge=50&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(res.content).eq('{"result":"WAIT","waitingFor":["black","red"]}');
  });

  for (const run of [
    {frozen: true, undoCount: 'stale', result: 'REFRESH'},
    {frozen: true, undoCount: 'current', result: 'WAIT'},
    {frozen: false, undoCount: 'stale', result: 'REFRESH'},
    {frozen: false, undoCount: 'current', result: 'GO'},
  ] as const) {
    it(`answers ${run.result} to a required input when frozen is ${run.frozen} and the undo count is ${run.undoCount}`, async () => {
      const [game, player] = testGame(2);
      await scaffolding.ctx.gameLoader.add(game);
      player.setWaitingFor(new SelectOption('Input'));
      game.frozen = run.frozen;
      game.undoCount = 1;
      const undoCount = run.undoCount === 'current' ? 1 : 0;

      scaffolding.url = `/api/waitingfor?id=${player.id}&gameAge=${game.gameAge}&undoCount=${undoCount}`;
      await scaffolding.get(ApiWaitingFor.INSTANCE, res);

      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content).result).eq(run.result);
    });
  }

  it('refreshes a spectator whose undo count is ahead of the game', async () => {
    const [game] = testGame(2);
    await scaffolding.ctx.gameLoader.add(game);

    scaffolding.url = `/api/waitingfor?id=${game.spectatorId}&gameAge=${game.gameAge}&undoCount=${game.undoCount + 1}`;
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);

    expect(JSON.parse(res.content).result).eq('REFRESH');
  });
});
