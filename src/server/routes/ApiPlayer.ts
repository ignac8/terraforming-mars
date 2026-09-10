import * as responses from '../server/responses';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {IPlayer} from '../IPlayer';

export class ApiPlayer extends Handler {
  public static readonly INSTANCE = new ApiPlayer();

  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const playerId = ctx.urlParams.playerId('id');
    const game = await ctx.gameLoader.getGame(playerId);
    if (game === undefined) {
      throw RouteError.notFound();
    }
    // Only the lookup is guarded: a wider catch turns every RouteError raised
    // below -- forbidden, unauthorized -- into a 404.
    let player: IPlayer;
    try {
      player = game.getPlayerById(playerId);
    } catch (err) {
      console.warn(`unable to find player ${playerId}`, err);
      throw RouteError.notFound();
    }

    if (!this.isUser(player.user, ctx)) {
      throw RouteError.forbidden();
    }
    this.checkPlayerPassword(player, ctx);

    ctx.ipTracker.addParticipant(playerId, ctx.ip);
    responses.writeJson(res, ctx, Server.getPlayerModel(player));
  }
}
