import * as responses from '../server/responses';
import {voteService} from '../rewind/vote/effects';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {readBody} from './readBody';
import {RouteError} from './RouteError';
import {Request} from '../Request';
import {Response} from '../Response';
import {IPlayer} from '../IPlayer';
import {Phase} from '../../common/Phase';
import {RewindCards} from '../../common/replay/ReplayModel';
import {RewindVotePoll} from '../../common/rewind/RewindVoteModel';

const FINISHED = 'A finished game can no longer be rewound by a vote.';

type VoteRequest =
  | {action: 'request', saveId: number, cards: RewindCards}
  | {action: 'yes' | 'no' | 'cancel', voteId: number};

function isId(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function parse(body: string): VoteRequest {
  let entity: any;
  try {
    entity = JSON.parse(body);
  } catch {
    throw RouteError.badRequest('invalid vote');
  }
  if (typeof entity === 'object' && entity !== null && !Array.isArray(entity)) {
    const keys = Object.keys(entity).length;
    if (entity.action === 'request' && keys === 3 && isId(entity.saveId) && (entity.cards === 'same' || entity.cards === 'shuffle')) {
      return {action: 'request', saveId: entity.saveId, cards: entity.cards};
    }
    if ((entity.action === 'yes' || entity.action === 'no' || entity.action === 'cancel') && keys === 2 && isId(entity.voteId)) {
      return {action: entity.action, voteId: entity.voteId};
    }
  }
  throw RouteError.badRequest('invalid vote');
}

/** The rewind vote of the multiplayer game of the player in the `id` parameter: GET polls it, POST asks for a rewind or answers the vote. */
export class ApiRewindVote extends Handler {
  public static readonly INSTANCE = new ApiRewindVote();
  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const player = await this.seat(ctx);
    responses.writeJson(res, ctx, voteService.poll(player.game, player));
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const player = await this.seat(ctx);
    // A finished game shows every seat's id, so the id alone would let a stranger reopen it.
    if (player.game.phase === Phase.END) {
      throw RouteError.badRequest(FINISHED);
    }
    const vote = parse(await readBody(req));
    let poll: RewindVotePoll;
    switch (vote.action) {
    case 'request':
      poll = await voteService.request(player.game, player, vote.saveId, vote.cards);
      break;
    case 'yes':
    case 'no':
      poll = await voteService.cast(player.game, player, vote.voteId, vote.action);
      break;
    case 'cancel':
      poll = await voteService.cancel(player.game, player, vote.voteId);
      break;
    }
    responses.writeJson(res, ctx, poll);
  }

  // The player in the `id` parameter.
  private async seat(ctx: Context): Promise<IPlayer> {
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
    return player;
  }
}
