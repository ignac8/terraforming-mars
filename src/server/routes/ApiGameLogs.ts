import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {GameLogs} from './GameLogs';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {checkMayShowUndone} from '../rewind/access';
import {isJudgeId, isPlayerId} from '../../common/Types';

export class ApiGameLogs extends Handler {
  public static readonly INSTANCE = new ApiGameLogs();
  private constructor(private gameLogs = new GameLogs()) {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const generation = ctx.urlParams.numberOrUndefined('generation');
    // Only the judge of a Judge undo game sees the lines that a rewind hid, and only when asked.
    const undone = ctx.urlParams.stringOrUndefined('undone') === '1';
    if (isJudgeId(ctx.urlParams.get('id'))) {
      const judgeGame = await this.loadJudgeGame(ctx);
      if (undone) {
        checkMayShowUndone(judgeGame, ctx.urlParams.judgeId('id'));
      }
      responses.writeJson(res, ctx, this.gameLogs.getLogsForJudge(judgeGame, generation, undone));
      return;
    }
    const id = ctx.urlParams.participantId('id');
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('game not found');
    }
    if (undone) {
      checkMayShowUndone(game, id);
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

