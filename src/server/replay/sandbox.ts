import {Game} from '../Game';
import {IGame} from '../IGame';
import {SerializedGame} from '../SerializedGame';

/**
 * Rebuilds a game from an old save. The game never writes to the database or the game cache,
 * and the save is not modified.
 */
export function loadSandboxGame(d: SerializedGame): IGame {
  return Game.deserialize(structuredClone(d), {sandbox: true});
}
