import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {isFinished, loadReplayState} from '../replay/ReplayService';
import {buildReplayView} from '../replay/replayView';
import {canBrowseHistory, canVoteRewind, judgeCanRewind} from '../rewind/access';
import {PLAYER_COLORS} from '../../common/Color';
import {ReplayViewAs} from '../../common/replay/ReplayModel';
import {isJudgeId, isPlayerId, PlayerId} from '../../common/Types';

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

    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined || (judge && game.judgeId !== id)) {
      throw RouteError.notFound('game not found');
    }
    // A running game's history is for whoever could rewind it. The judge of a judge-undo game sees
    // any view, everyone else only their own. This is answered before any password check, which can
    // claim an unclaimed seat: a replay read must not write to a running game.
    const running = !await isFinished(game);
    if (running) {
      if (!canBrowseHistory(game, id)) {
        throw RouteError.badRequest('game not finished');
      }
      if (!judgeCanRewind(game, id) && viewAs !== game.getPlayerById(id as PlayerId).color) {
        throw RouteError.badRequest('only your own view while the game runs');
      }
    }
    if (judge) {
      // An unclaimed judge seat is not claimed here: a replay read never writes to a game.
      if (game.judgePassword !== undefined) {
        this.checkJudgePassword(game, ctx);
      }
    } else if (isPlayerId(id)) {
      // A player's view carries their private cards, so a player needs the seat password. A vote
      // player's claimed seat is checked without the solo and finished-game exemptions, and never claimed.
      if (running && canVoteRewind(game, id)) {
        this.checkClaimedSeat(game.getPlayerById(id), ctx);
      } else {
        this.checkPlayerPassword(game.getPlayerById(id), ctx);
      }
    }

    const sandbox = await loadReplayState(game, saveId);
    responses.writeJson(res, ctx, buildReplayView(sandbox, id, saveId, viewAs));
  }
}

function isReplayViewAs(value: string): value is ReplayViewAs {
  return value === 'all' || (PLAYER_COLORS as ReadonlyArray<string>).includes(value);
}
