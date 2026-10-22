import {IGame} from '../IGame';
import {Context} from './IHandler';
import {RouteError} from './RouteError';

/**
 * Throws unless `game` is the object the loader serves now. A request reads its body after it took the game,
 * and a loaded game or a player undo can replace the object in the meantime without retiring it.
 */
export async function requireServedGame(game: IGame, ctx: Context): Promise<void> {
  if (game.retired || await ctx.gameLoader.getGame(game.id) !== game) {
    throw RouteError.badRequest('This game was rewound. Refresh this page.');
  }
}
