import * as responses from '../server/responses';
import {IHandler, Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {DiscordId} from '../server/auth/discord';
import {RouteError} from './RouteError';
import {assertNever} from '../../common/utils/utils';
import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {Phase} from '../../common/Phase';
import {randomBytes, timingSafeEqual} from 'crypto';

/** 48 bits, matching the fork this was ported from, but from a CSPRNG. */
const PASSWORD_BYTES = 6;
/** The shape of a password the server generates: PASSWORD_BYTES bytes as lowercase hex. */
const WELL_FORMED_PASSWORD = new RegExp(`^[0-9a-f]{${PASSWORD_BYTES * 2}}$`);

/** Compares two passwords without leaking their common prefix through timing. */
function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export type Options = {
  validateServerId: boolean;
  validateStatsId: boolean;
  auth: boolean;
}

const DISCORD_ADMIN_USER_IDS: Array<string> = [];

{
  const idsString = process.env.DISCORD_ADMIN_USER_IDS ?? '';
  for (const entry of idsString.split(';')) {
    const idString = entry.trim();
    if (idString === '') {
      continue;
    }
    // Discord snowflakes are 64-bit, so they exceed Number.MAX_SAFE_INTEGER. They're
    // validated as positive digit strings, which is also how `isUser` compares them.
    if (!/^[1-9][0-9]*$/.test(idString)) {
      console.error('invalid discord admin id ' + idString);
      continue;
    }
    DISCORD_ADMIN_USER_IDS.push(idString);
  }
}

/**
 * Processes an inbound HTTP request, and behaves as middleware.
 *
 * Inbound calls are passed to processRequest, which are then handed off to get post and put.
 * Subclasses should implemented get, post, and put, as expected.
 */
export abstract class Handler implements IHandler {
  private options: Options;
  constructor(options?: Partial<Options>) {
    this.options = {
      validateServerId: options?.validateServerId === true,
      validateStatsId: options?.validateStatsId === true,
      auth: options?.auth === true,
    };
  }

  // TODO(kberg): provide a good not authorized path. This collapses two failures into
  // one boolean: no session at all (401) and someone else's data (403). Callers can only
  // report `forbidden`.
  protected isUser(userId: DiscordId | undefined, ctx: Context): boolean {
    // Nobody's data to protect
    if (userId === undefined) {
      return true;
    }
    if (ctx.user?.id === undefined) {
      return false;
    }
    if (ctx.user.id === userId) {
      return true;
    }
    if (DISCORD_ADMIN_USER_IDS.includes(ctx.user?.id)) {
      return true;
    }
    return false;
  }

  /**
   * Gates a player seat when the game runs with `playerPasswords`.
   *
   * The first request to reach an unclaimed seat claims it: a fresh password is
   * generated and stored, and the caller is let through so the client can put it
   * in the URL. Every later request must carry that password.
   *
   * Callers must apply this to *every* player-scoped route. Guarding only the
   * route that serves the page leaves the seat wide open, since knowing a player
   * id is otherwise enough to submit that player's moves.
   */
  protected checkPlayerPassword(player: IPlayer, ctx: Context): void {
    const game = player.game;
    if (game.gameOptions.playerPasswords === false) {
      return;
    }
    // A solo game has no other seat to protect, and a finished game has no moves
    // left to make -- both stay readable without a password.
    if (game.isSoloMode() || game.phase === Phase.END) {
      return;
    }
    // The operator's serverId link is a master key, as it is elsewhere.
    if (this.isServerIdValid(ctx)) {
      return;
    }
    if (player.password === undefined) {
      player.password = randomBytes(PASSWORD_BYTES).toString('hex');
      return;
    }
    const incoming = ctx.urlParams.stringOrUndefined('password');
    if (incoming === undefined || !safeEquals(incoming, player.password)) {
      throw RouteError.unauthorized();
    }
  }

  /**
   * Gates the judge seat. The first request claims it and is let through. If it carries a
   * well-formed password (the format the server generates), that password becomes the seat's,
   * so a judge tab that outlives the stored claim keeps working. Otherwise a fresh password is
   * generated, and the client puts it in the URL. Every later request must carry the password.
   *
   * Unlike a player seat there is no exemption for solo games, finished games or games
   * without `playerPasswords`: the judge sees every player's hidden cards in all of them.
   */
  protected checkJudgePassword(game: IGame, ctx: Context): void {
    // The operator's serverId link is a master key, as it is elsewhere.
    if (this.isServerIdValid(ctx)) {
      return;
    }
    const incoming = ctx.urlParams.stringOrUndefined('password');
    if (game.judgePassword === undefined) {
      game.judgePassword = incoming !== undefined && WELL_FORMED_PASSWORD.test(incoming) ?
        incoming :
        randomBytes(PASSWORD_BYTES).toString('hex');
      return;
    }
    if (incoming === undefined || !safeEquals(incoming, game.judgePassword)) {
      throw RouteError.unauthorized();
    }
  }

  /**
   * Loads the game for the judge id in the `id` parameter and checks the judge password.
   * Responds 404 unless the id belongs to that game.
   */
  protected async loadJudgeGame(ctx: Context): Promise<IGame> {
    const id = ctx.urlParams.judgeId('id');
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined || game.judgeId !== id) {
      throw RouteError.notFound();
    }
    this.checkJudgePassword(game, ctx);
    return game;
  }

  private isServerIdValid(ctx: Context): boolean {
    if (ctx.user?.id && DISCORD_ADMIN_USER_IDS.includes(ctx.user?.id)) {
      return true;
    }
    const serverId = ctx.urlParams.stringOrUndefined('serverId');
    return serverId === ctx.ids.serverId;
  }

  private isStatsIdValid(ctx: Context): boolean {
    const serverId = ctx.urlParams.stringOrUndefined('serverId');
    return serverId !== null && serverId === ctx.ids.statsId;
  }

  /* Routes are async, so a thrown RouteError surfaces as a rejection, not a synchronous throw. */
  private handleError(e: unknown, req: Request, res: Response): void {
    if (e instanceof RouteError) {
      switch (e.kind) {
      case 'badRequest':
        responses.badRequest(req, res, e.detail);
        break;
      case 'contentTooLarge':
        responses.contentTooLarge(req, res);
        break;
      case 'forbidden':
        responses.forbidden(req, res);
        break;
      case 'internalServerError':
        responses.internalServerError(req, res, e.detail);
        break;
      case 'notFound':
        responses.notFound(req, res, e.detail);
        break;
      case 'unauthorized':
        responses.unauthorized(req, res, e.detail);
        break;
      default:
        assertNever(e.kind);
      }
      return;
    }
    responses.internalServerError(req, res, e);
  }

  public async processRequest(req: Request, res: Response, ctx: Context): Promise<void> {
    try {
      if (this.options.validateServerId && !this.isServerIdValid(ctx)) {
        throw RouteError.forbidden();
      }

      if (this.options.validateStatsId) {
        if (this.isServerIdValid(ctx)) {
          responses.downgradeRedirect(req, res, ctx);
          return Promise.resolve();
        }

        if (!this.isStatsIdValid(ctx)) {
          throw RouteError.forbidden();
        }
      }

      switch (req.method) {
      case 'GET':
        return await this.get(req, res, ctx);
      case 'POST':
        return await this.post(req, res, ctx);
      case 'PUT':
        return await this.put(req, res, ctx);
      default:
        throw RouteError.badRequest('Bad method');
      }
    } catch (e) {
      this.handleError(e, req, res);
      return Promise.resolve();
    }
  }

  public get(_req: Request, _res: Response, _ctx: Context): Promise<void> {
    throw RouteError.notFound();
  }
  public put(_req: Request, _res: Response, _ctx: Context): Promise<void> {
    throw RouteError.notFound();
  }
  public post(_req: Request, _res: Response, _ctx: Context): Promise<void> {
    throw RouteError.notFound();
  }
}
