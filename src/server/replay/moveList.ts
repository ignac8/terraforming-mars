import {Color} from '../../common/Color';
import {LogMessage} from '../../common/logs/LogMessage';
import {ReplayMove} from '../../common/replay/ReplayModel';
import {PlayerId} from '../../common/Types';
import {RecordedInput} from '../rewind/RecordedInput';
import {abandonedBy, activeRewinds, hiddenBy, RewindRecord} from '../rewind/RewindRecord';

/** `answeredBy`: who gave the answers the save recorded, which were applied to the state of the save before it. */
export type SaveEntry = {saveId: number; logLength: number; answeredBy?: ReadonlyArray<PlayerId>};

/** What tells who made each move: the players' colours, and, for the newest save, the live game's answers since. */
export type Movers = {colors: ReadonlyMap<PlayerId, Color>; newest?: ReadonlyArray<PlayerId>};

/** The distinct players who gave the recorded answers, in the order of their first answer. Empty when none were recorded. */
export function answerersOf(inputs: ReadonlyArray<RecordedInput> | undefined): Array<PlayerId> {
  return [...new Set((inputs ?? []).map((input) => input.playerId))];
}

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
 * at the end of the game, except the newest one. A save with no lines is kept when the next save
 * recorded an answer: a draft pick logs nothing, and such a move is marked `silent`. What is
 * abandoned and hidden is what the active rewinds abandoned and hid (see `activeRewinds`).
 *
 * With `showUndone`, the abandoned saves are listed too, in id order, each with `undone: true`, and
 * they hold the lines that were hidden, and only those, so every line is in exactly one move. An undone
 * save that a rewind wrote starts at its own marker, and a marker that still shows, because a later
 * rewind restored that save, stays with the later rewind's save. The save before a rewind's save ends
 * at the rewind's `logEnd`, where the marker starts, even though the rewind's save has a longer log.
 * An undone save with no lines of its own is left out like any other, so it is never a rewind target, unless the
 * save after it recorded an answer, as for an undone draft pick.
 *
 * With `movers`, each move names its players: those who gave the answers recorded in the next save by id,
 * which were applied to the state of this save. The newest save has no next one, so the live game's answers stand.
 */
export function buildMoveList(saves: ReadonlyArray<SaveEntry>, rewinds: ReadonlyArray<RewindRecord>, log: ReadonlyArray<LogMessage>, showUndone: boolean = false, movers?: Movers): Array<ReplayMove> {
  const active = activeRewinds(rewinds);
  const moves: Array<ReplayMove> = [];
  saves.forEach(({saveId, logLength}, idx) => {
    const undone = abandonedBy(saveId, active);
    if (undone && !showUndone) {
      return;
    }
    const record = rewinds.find((r) => r.saveId === saveId);
    const start = record === undefined ? logLength : undone ? record.logEnd : markerStart(record, rewinds);
    const next = saves[idx + 1];
    const end = next === undefined ? log.length : (rewinds.find((r) => r.saveId === next.saveId)?.logEnd ?? next.logLength);
    const messages = log.slice(start, end).filter((_, i) => hiddenBy(start + i, active) === undone);
    const answered = next === undefined ? movers?.newest : next.answeredBy;
    const silent = messages.length === 0 && next !== undefined && (answered ?? []).length > 0;
    if (messages.length > 0 || next === undefined || silent) {
      const colors = (answered ?? []).flatMap((id) => movers?.colors.get(id) ?? []);
      moves.push({saveId, messages, ...(undone ? {undone} : {}), ...(silent ? {silent} : {}), ...(colors.length === 0 ? {} : {movers: colors})});
    }
  });
  return moves;
}
