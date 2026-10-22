import * as responses from '../server/responses';
import {Server} from '../models/ServerModel';
import {judgeCanRewind} from '../rewind/access';
import {rewindTable} from '../rewind/RewindService';
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
  let entity: any;
  try {
    entity = JSON.parse(body);
  } catch {
    throw RouteError.badRequest('invalid rewind');
  }
  const isObject = typeof entity === 'object' && entity !== null && !Array.isArray(entity);
  if (
    !isObject ||
    Object.keys(entity).length !== 3 ||
    !Number.isInteger(entity.saveId) || entity.saveId < 0 ||
    (entity.cards !== 'same' && entity.cards !== 'shuffle') ||
    (entity.clocks !== 'back' && entity.clocks !== 'keep')) {
    throw RouteError.badRequest('invalid rewind');
  }
  return {saveId: entity.saveId, cards: entity.cards, clocks: entity.clocks};
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
    responses.writeJson(res, ctx, Server.getJudgeModel(restored));
  }
}
