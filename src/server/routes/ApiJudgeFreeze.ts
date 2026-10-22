import * as responses from '../server/responses';
import {Server} from '../models/ServerModel';
import {judgeCanRewind} from '../rewind/access';
import {freezeGame, unfreezeGame} from '../rewind/freeze';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {readBody} from './readBody';
import {requireServedGame} from './requireServedGame';
import {RouteError} from './RouteError';
import {Request} from '../Request';
import {Response} from '../Response';

function parse(body: string): boolean {
  let entity: any;
  try {
    entity = JSON.parse(body);
  } catch {
    throw RouteError.badRequest('invalid freeze');
  }
  const isObject = typeof entity === 'object' && entity !== null && !Array.isArray(entity);
  if (!isObject || Object.keys(entity).length !== 1 || typeof entity.frozen !== 'boolean') {
    throw RouteError.badRequest('invalid freeze');
  }
  return entity.frozen;
}

/**
 * Freezes or unfreezes the game of the judge in the `id` parameter, and answers the judge's view of it.
 * The body names the state the judge wants, so a stale judge tab is refused instead of flipping the freeze back.
 */
export class ApiJudgeFreeze extends Handler {
  public static readonly INSTANCE = new ApiJudgeFreeze();
  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const game = await this.loadJudgeGame(ctx);
    if (!judgeCanRewind(game, ctx.urlParams.judgeId('id'))) {
      throw RouteError.forbidden();
    }
    const frozen = parse(await readBody(req));
    await requireServedGame(game, ctx);
    const saved = await (frozen ? freezeGame(game) : unfreezeGame(game));
    // The change is made, in memory only: a restart brings the game back as it was saved.
    if (!saved) {
      throw RouteError.badRequest(frozen ? FREEZE_NOT_SAVED : UNFREEZE_NOT_SAVED);
    }
    responses.writeJson(res, ctx, Server.getJudgeModel(game));
  }
}

const FREEZE_NOT_SAVED = 'The game is frozen, but that was not saved. A restart would undo it.';
const UNFREEZE_NOT_SAVED = 'The game runs again, but that was not saved. A restart would freeze it again.';
