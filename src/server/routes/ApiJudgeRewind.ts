import * as responses from '../server/responses';
import {Server} from '../models/ServerModel';
import {incognitoMask, maskModel} from '../incognito/IncognitoMask';
import {judgeCanRewind} from '../rewind/access';
import {rewindTable} from '../rewind/RewindService';
import {voteService} from '../rewind/vote/effects';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {readBody} from './readBody';
import {ifServedGame} from './ifServedGame';
import {RouteError} from './RouteError';
import {Request} from '../Request';
import {Response} from '../Response';
import {RewindCards, RewindClocks} from '../../common/replay/ReplayModel';

type JudgeRewindRequest = {saveId: number, cards: RewindCards, clocks: RewindClocks};

function parse(body: string): JudgeRewindRequest {
  let entity: unknown;
  try {
    entity = JSON.parse(body);
  } catch {
    throw RouteError.badRequest('invalid rewind');
  }
  if (typeof entity !== 'object' || entity === null || Array.isArray(entity) || Object.keys(entity).length !== 3) {
    throw RouteError.badRequest('invalid rewind');
  }
  const {saveId, cards, clocks} = entity as Record<string, unknown>;
  if (
    typeof saveId !== 'number' || !Number.isInteger(saveId) || saveId < 0 ||
    (cards !== 'same' && cards !== 'shuffle') ||
    (clocks !== 'back' && clocks !== 'keep')) {
    throw RouteError.badRequest('invalid rewind');
  }
  return {saveId, cards, clocks};
}

/**
 * Rewinds the whole table of the game of the judge in the `id` parameter, and answers the judge's view of the
 * rewound game. The rewound game stays frozen until the judge unfreezes it.
 */
export class ApiJudgeRewind extends Handler {
  public static readonly INSTANCE = new ApiJudgeRewind();
  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const game = await this.loadJudgeGame(ctx);
    if (!judgeCanRewind(game, ctx.urlParams.judgeId('id'))) {
      throw RouteError.forbidden();
    }
    const {saveId, cards, clocks} = parse(await readBody(req));
    const restored = await ifServedGame(game, ctx, () => rewindTable(game, saveId, {cards, clocks, freeze: true}, {kind: 'judge'}));
    // The restored game holds no vote, so the one the old game had ends here.
    voteService.endForJudge(game, 'judge-rewound');
    responses.writeJson(res, ctx, maskModel(Server.getJudgeModel(restored), incognitoMask(restored, ctx.urlParams.judgeId('id'))));
  }
}
