import {LogMessage} from '../../common/logs/LogMessage';
import {ReplayMove} from '../../common/replay/ReplayModel';
import {isAbandonedSave, isHiddenLogIndex, RewindRecord} from '../rewind/RewindRecord';

export type SaveEntry = {saveId: number; logLength: number};

// Where a save that `record` wrote starts. A rewind's marker belongs to the state it restored,
// so when that state is itself the product of a rewind, the earlier marker comes along.
function markerStart(record: RewindRecord, rewinds: ReadonlyArray<RewindRecord>): number {
  const earlier = rewinds.find((r) => r.saveId === record.restoredSaveId);
  return earlier === undefined ? record.logEnd : markerStart(earlier, rewinds);
}

/**
 * Turns the saves of a game into its list of moves. `saves` are in ascending id order,
 * and `log` is the game's whole log, of which every save's log is a prefix.
 *
 * A save's messages run from its start to the next save's log length, without the lines that a
 * rewind hid. The next save is by id, abandoned ones included. A save that a rewind wrote starts
 * where the rewind's abandoned lines end, so the rewind's marker line is its own. If that rewind
 * restored a save that an earlier rewind wrote, the earlier marker stays with it too. Abandoned
 * saves are left out, and so are saves that changed nothing a viewer can see, e.g. the two saves
 * at the end of the game, except the newest one.
 *
 * With `showUndone`, the abandoned saves are listed too, in id order, each with `undone: true`, and
 * they keep the lines that were hidden. The save before a rewind's save ends at the rewind's
 * `logEnd`, where the marker starts, even though the rewind's save has a longer log.
 */
export function buildMoveList(saves: ReadonlyArray<SaveEntry>, rewinds: ReadonlyArray<RewindRecord>, log: ReadonlyArray<LogMessage>, showUndone: boolean = false): Array<ReplayMove> {
  const moves: Array<ReplayMove> = [];
  saves.forEach(({saveId, logLength}, idx) => {
    const undone = isAbandonedSave(saveId, rewinds);
    if (undone && !showUndone) {
      return;
    }
    const record = rewinds.find((r) => r.saveId === saveId);
    const start = record === undefined ? logLength : markerStart(record, rewinds);
    const next = saves[idx + 1];
    const end = next === undefined ? log.length : (rewinds.find((r) => r.saveId === next.saveId)?.logEnd ?? next.logLength);
    const messages = log.slice(start, end).filter((_, i) => undone || !isHiddenLogIndex(start + i, rewinds));
    if (messages.length > 0 || next === undefined) {
      moves.push(undone ? {saveId, messages, undone} : {saveId, messages});
    }
  });
  return moves;
}
