import {IGame} from '../../src/server/IGame';
import {RewindRecord} from '../../src/server/rewind/RewindRecord';
import {SerializedGame} from '../../src/server/SerializedGame';
import {LogMessage} from '../../src/common/logs/LogMessage';
import {LogMessageType} from '../../src/common/logs/LogMessageType';
import {Phase} from '../../src/common/Phase';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';

/** Save 5 restored save 2: saves 2 to 4 and lines 4 to 6 are what the rewind undid. Line 7 is its marker. */
export const REWIND: RewindRecord = {saveId: 5, restoredSaveId: 2, logStart: 4, logEnd: 7};

export const UNDONE_LINES = ['line 4', 'line 5', 'line 6'];

// What each save's log holds. The saves of the line that was undone end before the marker, and save 5 holds it.
const LOG_LENGTHS = [0, 2, 4, 5, 6, 9];

/**
 * Gives `game` the log and the saves of a game that one rewind has cut: the rows are what the database holds, and the
 * game has the rewind's record, as a live game that was rewound does. The newest save is the game itself, which a
 * finished game has in the END phase.
 */
export function storeRewoundSaves(db: InMemoryDatabase, game: IGame, finished: boolean): void {
  game.gameLog.length = 0;
  for (let i = 0; i < 9; i++) {
    game.gameLog.push(new LogMessage(LogMessageType.DEFAULT, `line ${i}`, []));
  }
  game.rewinds = [REWIND];
  const base: SerializedGame = game.serialize();
  const rows = LOG_LENGTHS.map((length): SerializedGame => ({...base, gameLog: base.gameLog.slice(0, length)}));
  if (finished) {
    rows[rows.length - 1] = {...rows[rows.length - 1], phase: Phase.END};
    game.phase = Phase.END;
  }
  db.games.set(game.id, rows);
}
