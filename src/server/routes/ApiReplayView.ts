import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {isFinished, loadReplayState} from '../replay/ReplayService';
import {buildReplayView} from '../replay/replayView';
import {canBrowseHistory} from '../rewind/access';
import {PLAYER_COLORS} from '../../common/Color';
import {ReplayViewAs} from '../../common/replay/ReplayModel';
import {PlayerId} from '../../common/Types';

export class ApiReplayView extends Handler {
  public static readonly INSTANCE = new ApiReplayView();
  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.urlParams.participantId('id');
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

    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('game not found');
    }
    // A running game's history is for whoever could rewind it, and only in their own view.
    if (!await isFinished(game)) {
      if (!canBrowseHistory(game, id)) {
        throw RouteError.badRequest('game not finished');
      }
      if (viewAs !== game.getPlayerById(id as PlayerId).color) {
        throw RouteError.badRequest('only your own view while the game runs');
      }
    }

    const sandbox = await loadReplayState(game, saveId);
    responses.writeJson(res, ctx, buildReplayView(sandbox, id, saveId, viewAs));
  }
}

function isReplayViewAs(value: string): value is ReplayViewAs {
  return value === 'all' || (PLAYER_COLORS as ReadonlyArray<string>).includes(value);
}
