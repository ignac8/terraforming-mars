import {IGame} from '../../src/server/IGame';
import {InMemoryDatabase} from './InMemoryDatabase';

/**
 * An InMemoryDatabase whose rows are copies. InMemoryDatabase stores `game.serialize()`, which holds
 * the live game log array by reference, so every row of one game would share one log.
 */
export class SnapshotDatabase extends InMemoryDatabase {
  public override saveGame(game: IGame): Promise<void> {
    const saveId = game.lastSaveId;
    const result = super.saveGame(game);
    const row = this.games.get(game.id)!;
    row[saveId] = structuredClone(row[saveId]!);
    return result;
  }
}
