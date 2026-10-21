import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {getReplayMoves, isFinished} from '../replay/ReplayService';
import {isJudgeId, isPlayerId} from '../../common/Types';

export class ApiReplayMoves extends Handler {
  public static readonly INSTANCE = new ApiReplayMoves();
  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    // A judge never plays, so a judge id has no seat of its own. The judge sees every private log
    // line, marked with its owner's color (see getReplayMoves).
    if (isJudgeId(ctx.urlParams.get('id'))) {
      const judgeId = ctx.urlParams.judgeId('id');
      const judgeGame = await ctx.gameLoader.getGame(judgeId);
      if (judgeGame === undefined || judgeGame.judgeId !== judgeId) {
        throw RouteError.notFound();
      }
      // The password checks can claim an unclaimed seat. A replay read never writes to a game and
      // never hands a password back, so only a finished game with a claimed judge seat is checked.
      // An unclaimed seat lets the judge link through, as the link alone is the credential.
      if (judgeGame.judgePassword !== undefined && await isFinished(judgeGame)) {
        this.checkJudgePassword(judgeGame, ctx);
      }
      responses.writeJson(res, ctx, await getReplayMoves(judgeGame, judgeId));
      return;
    }
    const id = ctx.urlParams.participantId('id');
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('game not found');
    }
    // The moves carry the viewer's private log lines, so a player needs the seat password.
    // Only a finished game is checked, see above.
    if (isPlayerId(id) && await isFinished(game)) {
      this.checkPlayerPassword(game.getPlayerById(id), ctx);
    }
    responses.writeJson(res, ctx, await getReplayMoves(game, id));
  }
}
