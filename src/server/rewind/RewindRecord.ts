import {LogMessage} from '../../common/logs/LogMessage';

/**
 * What one rewind left behind. A rewind keeps every save row and every log line, so a record
 * says which of them belong to the line of play that was abandoned.
 */
export type RewindRecord = {
  /** The save the rewind wrote. Play continues from it. */
  saveId: number;
  /** The save that was restored. Saves from it up to, not including, `saveId` are the abandoned line. */
  restoredSaveId: number;
  /** Game log entries from `logStart` up to, not including, `logEnd` are the abandoned line. */
  logStart: number;
  logEnd: number;
};

/**
 * The records whose abandoned stretch is still abandoned. Walking the records in order (ascending saveId), a rewind r
 * keeps the records that were active right after the last record with saveId <= r.restoredSaveId, and adds itself.
 * The answer is the active set after the last record.
 *
 * A rewind restores what was visible when its target was the newest save, and the records older than that save decide
 * it. So a rewind to a save that an earlier rewind abandoned brings that line back and abandons the one that was live.
 */
export function activeRewinds(rewinds: ReadonlyArray<RewindRecord>): Array<RewindRecord> {
  const after: Array<Array<RewindRecord>> = [];
  rewinds.forEach((record, i) => {
    const base = rewinds.slice(0, i).findLastIndex((r) => r.saveId <= record.restoredSaveId);
    after.push([...(base < 0 ? [] : after[base]), record]);
  });
  return after[after.length - 1] ?? [];
}

/** Whether a record of `active`, the result of `activeRewinds`, abandoned the save. For callers that check many. */
export function abandonedBy(saveId: number, active: ReadonlyArray<RewindRecord>): boolean {
  return active.some((r) => saveId >= r.restoredSaveId && saveId < r.saveId);
}

/** Whether a record of `active`, the result of `activeRewinds`, hid the log line. For callers that check many. */
export function hiddenBy(idx: number, active: ReadonlyArray<RewindRecord>): boolean {
  return active.some((r) => idx >= r.logStart && idx < r.logEnd);
}

export function isAbandonedSave(saveId: number, rewinds: ReadonlyArray<RewindRecord>): boolean {
  return abandonedBy(saveId, activeRewinds(rewinds));
}

export function isHiddenLogIndex(idx: number, rewinds: ReadonlyArray<RewindRecord>): boolean {
  return hiddenBy(idx, activeRewinds(rewinds));
}

export function visibleLog(log: ReadonlyArray<LogMessage>, rewinds: ReadonlyArray<RewindRecord>): Array<LogMessage> {
  const active = activeRewinds(rewinds);
  return log.filter((_, idx) => !hiddenBy(idx, active));
}
