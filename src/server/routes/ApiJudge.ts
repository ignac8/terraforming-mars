import * as responses from '../server/responses';
import {Server} from '../models/ServerModel';
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
    responses.writeJson(res, ctx, Server.getJudgeModel(game));
  }
}
