import * as responses from '../server/responses';
import {Database} from '../database/Database';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {LoadGameFormModel} from '../../common/models/LoadGameFormModel';
import {Request} from '../Request';
import {Response} from '../Response';
import {GameId, isGameId, isPlayerId, isSpectatorId} from '../../common/Types';
import {RouteError} from './RouteError';
import {readBody} from './readBody';
import {forgetReplay} from '../replay/ReplayService';
import {isTableLocked, withTableLock} from '../rewind/tableLock';

export class LoadGame extends Handler {
  public static readonly INSTANCE = new LoadGame();
  private constructor() {
    super({validateServerId: true});
  }

  private async getGameId(id: string): Promise<GameId | undefined> {
    if (isGameId(id)) {
      return id;
    }
    if (isPlayerId(id) || isSpectatorId(id)) {
      return await Database.getInstance().getGameId(id);
    }
    return undefined;
  }

  public override async put(req: Request, res: Response, ctx: Context): Promise<void> {
    const body = await readBody(req);
    const gameReq: LoadGameFormModel = JSON.parse(body);

    const gameId = await this.getGameId(gameReq.gameId);
    if (gameId === undefined) {
      throw RouteError.notFound('Invalid game id');
    }
    // The rollback deletes saves and replaces the cached game, so it never runs during a rewind or a freeze.
    if (isTableLocked(gameId)) {
      throw RouteError.badRequest('The table is being rewound or frozen. Click OK to refresh this page.');
    }
    await withTableLock(gameId, async () => {
      const rollbackCount = gameReq.rollbackCount;
      if (rollbackCount > 0) {
        try {
          await Database.getInstance().deleteGameNbrSaves(gameId, rollbackCount);
        } catch (error) {
          console.error(error);
          throw RouteError.internalServerError();
        } finally {
          // Not after the reload only: the abandoned list must not be served while the game loads.
          forgetReplay(gameId);
        }
      }
      const game = await ctx.gameLoader.getGame(gameId, /* bypassCache */ true);
      // A rollback can remove the END save, and with it what the replay knew about the game.
      forgetReplay(gameId);
      if (game === undefined) {
        console.warn(`unable to find ${gameId} in database`);
        throw RouteError.notFound('game_id not found');
      }
      responses.writeJson(res, ctx, Server.getSimpleGameModel(game));
    });
  }
}
