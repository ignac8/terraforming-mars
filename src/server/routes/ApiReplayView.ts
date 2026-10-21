import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {loadReplayState} from '../replay/ReplayService';
import {buildReplayView} from '../replay/replayView';
import {PLAYER_COLORS} from '../../common/Color';
import {Phase} from '../../common/Phase';
import {ReplayViewAs} from '../../common/replay/ReplayModel';
import {isJudgeId, isPlayerId} from '../../common/Types';

export class ApiReplayView extends Handler {
  public static readonly INSTANCE = new ApiReplayView();
  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    // A judge never plays, so a judge id gets the same view as a spectator id.
    const judge = isJudgeId(ctx.urlParams.get('id'));
    const id = judge ? ctx.urlParams.judgeId('id') : ctx.urlParams.participantId('id');
    const saveParam = ctx.urlParams.get('save');
    // Number('') is 0, so digits are checked first.
    const saveId = /^[0-9]+$/.test(saveParam) ? Number(saveParam) : NaN;
    if (!Number.isSafeInteger(saveId)) {
      throw RouteError.badRequest('invalid save');
    }
    const viewAs = ctx.urlParams.get('as');
    if (!isReplayViewAs(viewAs)) {
      throw RouteError.badRequest('invalid as');
    }

    const game = judge ? await this.loadJudgeGame(ctx) : await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('game not found');
    }
    // A player's view carries their private cards, so a player needs the seat password.
    if (isPlayerId(id)) {
      this.checkPlayerPassword(game.getPlayerById(id), ctx);
    }
    if (game.phase !== Phase.END) {
      throw RouteError.badRequest('game not finished');
    }

    const sandbox = await loadReplayState(game, saveId);
    responses.writeJson(res, ctx, buildReplayView(sandbox, id, saveId, viewAs));
  }
}

function isReplayViewAs(value: string): value is ReplayViewAs {
  return value === 'all' || (PLAYER_COLORS as ReadonlyArray<string>).includes(value);
}
