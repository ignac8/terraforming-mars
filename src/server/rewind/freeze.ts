import {IGame} from '../IGame';
import {RouteError} from '../routes/RouteError';
import {Phase} from '../../common/Phase';
import {withTableLock} from './tableLock';

/**
 * Stops every input and every clock of `game` until unfreezeGame, and saves that into the newest save.
 * Refuses a finished game, a frozen one and a replaced game object.
 *
 * Resolves to whether the freeze reached the database. When it did not, the game is frozen in memory
 * all the same, and the caller says that the freeze was not saved.
 */
export function freezeGame(game: IGame): Promise<boolean> {
  return withTableLock(game.id, () => {
    refuseReplaced(game);
    if (game.phase === Phase.END) {
      throw RouteError.badRequest('The game has ended.');
    }
    if (game.frozen) {
      throw RouteError.badRequest('The game is already frozen.');
    }
    // Before anything is awaited, so no input gets in between.
    game.frozen = true;
    game.players.forEach((player) => player.timer.pause());
    game.undoCount++;
    return persist(game, 'freeze');
  });
}

/**
 * Lets play and the clocks go on again, and saves that. Refuses a game that isn't frozen.
 * Resolves to whether that reached the database, as freezeGame does.
 */
export function unfreezeGame(game: IGame): Promise<boolean> {
  return withTableLock(game.id, () => {
    refuseReplaced(game);
    if (!game.frozen) {
      throw RouteError.badRequest('The game is not frozen.');
    }
    game.frozen = false;
    // Prompts reached while frozen started no clock, so the ones the freeze paused are not the only ones to start.
    for (const player of game.players) {
      const waitingFor = player.getWaitingFor();
      if (waitingFor !== undefined && !waitingFor.optional) {
        player.timer.resume();
      }
    }
    game.undoCount++;
    return persist(game, 'unfreeze');
  });
}

// A rewind replaced this object after the request took it.
function refuseReplaced(game: IGame) {
  if (game.retired) {
    throw RouteError.badRequest('This game was rewound. Refresh this page.');
  }
}

async function persist(game: IGame, what: string): Promise<boolean> {
  try {
    if (await game.persistTableState()) {
      return true;
    }
    console.warn(`${what}: the table state of ${game.id} was not saved`);
  } catch (err) {
    console.warn(`${what}: unable to save the table state of ${game.id}`, err);
  }
  return false;
}
