import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {GameLogs} from './GameLogs';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {isPlayerId} from '../../common/Types';

export class ApiGameLogs extends Handler {
  public static readonly INSTANCE = new ApiGameLogs();
  private constructor(private gameLogs = new GameLogs()) {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.urlParams.participantId('id');
    const generation = ctx.urlParams.numberOrUndefined('generation');
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('game not found');
    }
    // A player's log carries private lines (cards bought and drawn), so it needs
    // the same seat password as the player page. The spectator log has none.
    if (isPlayerId(id)) {
      this.checkPlayerPassword(game.getPlayerById(id), ctx);
    }
    const logs = this.gameLogs.getLogsForGameView(id, game, generation);
    responses.writeJson(res, ctx, logs);
  }
}

