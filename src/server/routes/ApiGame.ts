import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Server} from '../models/ServerModel';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {Phase} from '../../common/Phase';

/**
 * Returns a light view of a game.
 */
export class ApiGame extends Handler {
  public static readonly INSTANCE = new ApiGame();
  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const gameId = ctx.urlParams.gameId('id');
    const game = await ctx.gameLoader.getGame(gameId);
    if (game === undefined) {
      throw RouteError.notFound('game not found');
    }
    const model = Server.getSimpleGameModel(game);
    // A finished solo or MarsBot game can still be rewound with its player's id, and its log shows the game id to spectators.
    if (game.phase === Phase.END && game.players.length === 1) {
      model.players = model.players.map(({color, name}) => ({color, name}));
    }
    responses.writeJson(res, ctx, model);
  }
}
