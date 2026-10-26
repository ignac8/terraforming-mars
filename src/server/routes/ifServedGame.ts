import {IGame} from '../IGame';
import {Context} from './IHandler';
import {RouteError} from './RouteError';

/**
 * Runs `f` unless `game` is no longer the object the loader serves, and otherwise throws. A request reads its
 * body after it took the game, and a loaded game or a player undo can replace the object in the meantime
 * without retiring it. `f` starts in the same step as the check, so a table operation takes its lock before
 * anything else can run.
 */
export async function ifServedGame<T>(game: IGame, ctx: Context, f: () => Promise<T>): Promise<T> {
  if (game.retired || await ctx.gameLoader.getGame(game.id) !== game) {
    throw RouteError.badRequest('This game was rewound. Refresh this page.');
  }
  return f();
}
