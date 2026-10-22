import {LogMessage} from '../../common/logs/LogMessage';
import {ReplayMove} from '../../common/replay/ReplayModel';
import {isAbandonedSave, RewindRecord} from '../rewind/RewindRecord';

export type SaveEntry = {saveId: number; logLength: number};

/**
 * Turns the saves of a finished game into its list of moves. `saves` are in ascending id order,
 * and `log` is the game's whole log, of which every save's log is a prefix.
 *
 * A save's messages run from its start to the next save's log length. The next save is by id,
 * abandoned ones included. A save that a rewind wrote starts where the rewind's abandoned lines
 * end, so the rewind's marker line is its own. Abandoned saves are left out, and so are saves
 * that changed nothing a viewer can see, e.g. the two saves at the end of the game, except the
 * newest one.
 */
export function buildMoveList(saves: ReadonlyArray<SaveEntry>, rewinds: ReadonlyArray<RewindRecord>, log: ReadonlyArray<LogMessage>): Array<ReplayMove> {
  const moves: Array<ReplayMove> = [];
  saves.forEach(({saveId, logLength}, idx) => {
    if (isAbandonedSave(saveId, rewinds)) {
      return;
    }
    const start = rewinds.find((r) => r.saveId === saveId)?.logEnd ?? logLength;
    const next = saves[idx + 1];
    const end = next === undefined ? log.length : next.logLength;
    const messages = log.slice(start, end);
    if (messages.length > 0 || next === undefined) {
      moves.push({saveId, messages});
    }
  });
  return moves;
}
