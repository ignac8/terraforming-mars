import * as responses from '../server/responses';
import {Server} from '../models/ServerModel';
import {incognitoMask, maskModel} from '../incognito/IncognitoMask';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';

export class ApiJudge extends Handler {
  public static readonly INSTANCE = new ApiJudge();

  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const game = await this.loadJudgeGame(ctx);
    // The judge sees every hand, but not who sits where while an incognito game runs.
    responses.writeJson(res, ctx, maskModel(Server.getJudgeModel(game), incognitoMask(game, ctx.urlParams.judgeId('id'))));
  }
}
