import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {getReplayMoves} from '../replay/ReplayService';

export class ApiReplayMoves extends Handler {
  public static readonly INSTANCE = new ApiReplayMoves();
  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.urlParams.participantId('id');
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('game not found');
    }
    responses.writeJson(res, ctx, await getReplayMoves(game, id));
  }
}
