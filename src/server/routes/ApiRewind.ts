import * as responses from '../server/responses';
import {Server} from '../models/ServerModel';
import {rewindGame} from '../rewind/RewindService';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {readBody} from './readBody';
import {RouteError} from './RouteError';
import {Request} from '../Request';
import {Response} from '../Response';
import {IPlayer} from '../IPlayer';
import {RewindCards} from '../../common/replay/ReplayModel';
import {incognitoMask, maskModel} from '../incognito/IncognitoMask';

type RewindRequest = {saveId: number, cards: RewindCards};

function parse(body: string): RewindRequest {
  let entity: unknown;
  try {
    entity = JSON.parse(body);
  } catch {
    throw RouteError.badRequest('invalid rewind');
  }
  if (typeof entity !== 'object' || entity === null || Array.isArray(entity) || Object.keys(entity).length !== 2) {
    throw RouteError.badRequest('invalid rewind');
  }
  const {saveId, cards} = entity as Record<string, unknown>;
  if (typeof saveId !== 'number' || !Number.isInteger(saveId) || saveId < 0 || (cards !== 'same' && cards !== 'shuffle')) {
    throw RouteError.badRequest('invalid rewind');
  }
  return {saveId, cards};
}

/** Rewinds the solo game of the player in the `id` parameter, and answers the player's view of the rewound game. */
export class ApiRewind extends Handler {
  public static readonly INSTANCE = new ApiRewind();
  private constructor() {
    super();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const playerId = ctx.urlParams.playerId('id');
    const game = await ctx.gameLoader.getGame(playerId);
    if (game === undefined) {
      throw RouteError.notFound();
    }
    let player: IPlayer;
    try {
      player = game.getPlayerById(playerId);
    } catch (err) {
      console.warn(`unable to find player ${playerId}`, err);
      throw RouteError.notFound();
    }
    this.checkPlayerPassword(player, ctx);
    const {saveId, cards} = parse(await readBody(req));
    const restored = await rewindGame(game, player, saveId, cards);
    responses.writeJson(res, ctx, maskModel(Server.getPlayerModel(restored.getPlayerById(playerId)), incognitoMask(restored, playerId)));
  }
}
