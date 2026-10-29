import {LogMessage} from '../../src/common/logs/LogMessage';
import {LogMessageType} from '../../src/common/logs/LogMessageType';
import {SaveEntry} from '../../src/server/replay/moveList';
import {RewindRecord} from '../../src/server/rewind/RewindRecord';

type Seen = {saves: Set<number>, lines: Set<number>};

/**
 * The saves, log and rewind records of a game, written the way the game writes them: a move adds two log lines and
 * a save, and a rewind records what it abandons, then adds its marker line and a save. Beside them it keeps what a
 * viewer should see, worked out from the play itself: the saves and lines that were visible when each save was the
 * newest. A move keeps what was visible and adds itself. A rewind's save stands for the save it restored, so it sees
 * what was visible when that save was the newest, with the restored save swapped for its own, and its marker.
 */
export class RewindHistory {
  public readonly saves: Array<SaveEntry> = [{saveId: 0, logLength: 0}];
  public readonly rewinds: Array<RewindRecord> = [];
  public readonly log: Array<LogMessage> = [];
  private readonly seen: Array<Seen> = [{saves: new Set([0]), lines: new Set()}];
  /** Whether every rewind restored a save that was visible at the time. */
  public everyTargetVisible = true;

  constructor(moves: number) {
    for (let i = 0; i < moves; i++) {
      this.move();
    }
  }

  public get newest(): number {
    return this.saves.length - 1;
  }

  /** The saves that are visible now. */
  public get visibleSaves(): Set<number> {
    return this.seen[this.newest].saves;
  }

  /** The log lines that are visible now. */
  public get visibleLines(): Set<number> {
    return this.seen[this.newest].lines;
  }

  public move(): this {
    const {saves, lines} = this.seen[this.newest];
    this.write({saves: new Set(saves), lines: new Set(lines)}, [this.line('move'), this.line('move')]);
    return this;
  }

  public rewind(target: number): RewindRecord {
    if (!this.visibleSaves.has(target)) {
      this.everyTargetVisible = false;
    }
    const record = {saveId: this.saves.length, restoredSaveId: target, logStart: this.saves[target].logLength, logEnd: this.log.length};
    this.rewinds.push(record);
    const {saves, lines} = this.seen[target];
    const seen = {saves: new Set(saves), lines: new Set(lines)};
    seen.saves.delete(target);
    this.write(seen, [this.line('marker')]);
    return record;
  }

  private line(text: string): number {
    this.log.push(new LogMessage(LogMessageType.DEFAULT, `${text} ${this.log.length}`, []));
    return this.log.length - 1;
  }

  private write(seen: Seen, lines: Array<number>): void {
    const saveId = this.saves.length;
    lines.forEach((idx) => seen.lines.add(idx));
    seen.saves.add(saveId);
    this.seen.push(seen);
    this.saves.push({saveId, logLength: this.log.length});
  }
}

/**
 * Every history of a game of `moves` moves followed by `count` rewinds, each to any save there is at the time and
 * followed by one move.
 */
export function everyHistory(moves: number, count: number): Array<{history: RewindHistory, targets: Array<number>}> {
  const build = (targets: ReadonlyArray<number>) => {
    const history = new RewindHistory(moves);
    for (const target of targets) {
      history.rewind(target);
      history.move();
    }
    return history;
  };
  let all: Array<Array<number>> = [[]];
  for (let i = 0; i < count; i++) {
    all = all.flatMap((targets) => Array.from({length: build(targets).newest + 1}, (_, target) => [...targets, target]));
  }
  return all.map((targets) => ({history: build(targets), targets}));
}
