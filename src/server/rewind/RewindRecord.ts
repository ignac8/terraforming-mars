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

export function isAbandonedSave(saveId: number, rewinds: ReadonlyArray<RewindRecord>): boolean {
  return rewinds.some((r) => saveId >= r.restoredSaveId && saveId < r.saveId);
}

export function visibleLog(log: ReadonlyArray<LogMessage>, rewinds: ReadonlyArray<RewindRecord>): Array<LogMessage> {
  if (rewinds.length === 0) {
    return [...log];
  }
  return log.filter((_, idx) => !rewinds.some((r) => idx >= r.logStart && idx < r.logEnd));
}
