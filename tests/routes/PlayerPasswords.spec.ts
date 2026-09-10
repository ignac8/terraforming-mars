import {expect} from 'chai';
import {ApiPlayer} from '../../src/server/routes/ApiPlayer';
import {ApiWaitingFor} from '../../src/server/routes/ApiWaitingFor';
import {ApiSpectator} from '../../src/server/routes/ApiSpectator';
import {PlayerInput} from '../../src/server/routes/PlayerInput';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {SpectatorModel} from '../../src/common/models/SpectatorModel';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '@/common/http/statusCode';
import {Phase} from '../../src/common/Phase';

describe('player passwords', () => {
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
    game = Game.newInstance('gameid', [player, opponent], player, 'spectatorid', {playerPasswords: true});
    await scaffolding.ctx.gameLoader.add(game);
  });

  /** Fetches the player page, returning the parsed model. Fails the test on a non-200. */
  async function getPlayer(query: string): Promise<PlayerViewModel> {
    const response = new MockResponse();
    scaffolding.url = '/api/player?id=' + player.id + query;
    await scaffolding.get(ApiPlayer.INSTANCE, response);
    expect(response.statusCode).eq(statusCode.ok);
    return JSON.parse(response.content);
  }

  it('the first visitor claims the seat and is handed the password', async () => {
    expect(player.password).is.undefined;

    const model = await getPlayer('');

    expect(player.password).is.not.undefined;
    expect(model.password).eq(player.password);
  });

  it('a later visitor without the password is refused', async () => {
    await getPlayer('');

    scaffolding.url = '/api/player?id=' + player.id;
    await scaffolding.get(ApiPlayer.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.unauthorized);
  });

  it('a later visitor with the wrong password is refused', async () => {
    await getPlayer('');

    scaffolding.url = '/api/player?id=' + player.id + '&password=deadbeef';
    await scaffolding.get(ApiPlayer.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.unauthorized);
  });

  it('the claimant keeps access with the password', async () => {
    const model = await getPlayer('');

    const second = await getPlayer('&password=' + model.password);

    expect(second.id).eq(player.id);
  });

  it('the serverId link still gets through', async () => {
    await getPlayer('');

    // scaffolding sets serverId to '1'
    const model = await getPlayer('&serverId=1');

    expect(model.id).eq(player.id);
  });

  it('waitingfor is gated too', async () => {
    await getPlayer('');

    scaffolding.url = '/api/waitingfor?id=' + player.id + '&gameAge=0&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.unauthorized);
  });

  it('player input is gated too', async () => {
    await getPlayer('');

    scaffolding.url = '/player/input?id=' + player.id;
    await scaffolding.post(PlayerInput.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.unauthorized);
  });

  it('an opponent cannot read this seat password from their own player page', async () => {
    await getPlayer('');

    const response = new MockResponse();
    scaffolding.url = '/api/player?id=' + opponent.id;
    await scaffolding.get(ApiPlayer.INSTANCE, response);
    const model: PlayerViewModel = JSON.parse(response.content);

    expect(model.players).has.length(2);
    for (const publicPlayer of model.players) {
      expect(publicPlayer).does.not.have.property('password');
    }
    expect(JSON.parse(response.content).password).eq(opponent.password);
  });

  it('a spectator cannot read any seat password', async () => {
    await getPlayer('');

    scaffolding.url = '/api/spectator?id=spectatorid';
    await scaffolding.get(ApiSpectator.INSTANCE, res);
    const model: SpectatorModel = JSON.parse(res.content);

    expect(model.players).has.length(2);
    for (const publicPlayer of model.players) {
      expect(publicPlayer).does.not.have.property('password');
    }
  });

  it('a finished game needs no password', async () => {
    await getPlayer('');
    game.phase = Phase.END;

    scaffolding.url = '/api/player?id=' + player.id;
    await scaffolding.get(ApiPlayer.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.ok);
  });

  it('the option off leaves no seat claimed', async () => {
    const solitary = TestPlayer.RED.newPlayer();
    const other = TestPlayer.GREEN.newPlayer();
    const openGame = Game.newInstance('gameid2', [solitary, other], solitary, 'spectatorid2', {playerPasswords: false});
    await scaffolding.ctx.gameLoader.add(openGame);

    scaffolding.url = '/api/player?id=' + solitary.id;
    await scaffolding.get(ApiPlayer.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.ok);
    expect(solitary.password).is.undefined;
  });

  it('a solo game needs no password', async () => {
    const soloPlayer = TestPlayer.RED.newPlayer();
    const soloGame = Game.newInstance('gameid3', [soloPlayer], soloPlayer, 'spectatorid3', {playerPasswords: true});
    await scaffolding.ctx.gameLoader.add(soloGame);

    scaffolding.url = '/api/player?id=' + soloPlayer.id;
    await scaffolding.get(ApiPlayer.INSTANCE, res);

    expect(res.statusCode).eq(statusCode.ok);
    expect(soloPlayer.password).is.undefined;
  });

  it('the claim survives serialization', async () => {
    const model = await getPlayer('');

    const restored = Game.deserialize(game.serialize());

    expect(restored.getPlayerById(player.id).password).eq(model.password);
  });
});
