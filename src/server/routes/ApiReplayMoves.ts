import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {getReplayMoves} from '../replay/ReplayService';
import {isJudgeId, isPlayerId} from '../../common/Types';

export class ApiReplayMoves extends Handler {
  public static readonly INSTANCE = new ApiReplayMoves();
  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    // A judge never plays, so a judge id gets the same moves as a spectator id.
    if (isJudgeId(ctx.urlParams.get('id'))) {
      const judgeGame = await this.loadJudgeGame(ctx);
      responses.writeJson(res, ctx, await getReplayMoves(judgeGame, ctx.urlParams.judgeId('id')));
      return;
    }
    const id = ctx.urlParams.participantId('id');
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('game not found');
    }
    // The moves carry the viewer's private log lines, so a player needs the seat password.
    if (isPlayerId(id)) {
      this.checkPlayerPassword(game.getPlayerById(id), ctx);
    }
    responses.writeJson(res, ctx, await getReplayMoves(game, id));
  }
}
