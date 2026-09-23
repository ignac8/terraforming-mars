/** Aggregates game results into per-cell statistics with 95% confidence intervals. */
import {GameResult} from './runGame';

export type CellStats = {
  n: number,
  wins: number,
  winRate: number,
  /** Wilson 95% interval for the win rate. */
  winLow: number,
  winHigh: number,
  /** Mean of (scripted player VP - MarsBot VP). */
  margin: number,
  /** Half-width of the 95% interval for the mean margin. */
  marginCI: number,
  humanVP: number,
  botVP: number,
  generation: number,
  generationLimitRate: number,
  errors: number,
  human: Record<string, number>,
  bot: Record<string, number>,
};

type Row = GameResult & {study: 'A' | 'B'};

function mean(xs: ReadonlyArray<number>): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function wilson(wins: number, n: number): [number, number] {
  if (n === 0) {
    return [0, 0];
  }
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + z * z / n;
  const centre = (p + z * z / (2 * n)) / denom;
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function meanOfKeys(rows: ReadonlyArray<Row>, pick: (r: Row) => Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  if (rows.length === 0) {
    return out;
  }
  for (const key of Object.keys(pick(rows[0]))) {
    out[key] = mean(rows.map((r) => pick(r)[key]));
  }
  return out;
}

export function cellStats(rows: ReadonlyArray<Row>): CellStats {
  const ok = rows.filter((r) => r.error === undefined);
  const n = ok.length;
  const wins = ok.filter((r) => r.humanWon).length;
  const margins = ok.map((r) => r.humanVP - r.botVP);
  const m = mean(margins);
  const variance = n > 1 ? margins.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1) : 0;
  const [winLow, winHigh] = wilson(wins, n);
  return {
    n,
    wins,
    winRate: n === 0 ? 0 : wins / n,
    winLow,
    winHigh,
    margin: m,
    marginCI: n > 1 ? 1.96 * Math.sqrt(variance / n) : 0,
    humanVP: mean(ok.map((r) => r.humanVP)),
    botVP: mean(ok.map((r) => r.botVP)),
    generation: mean(ok.map((r) => r.generation)),
    generationLimitRate: mean(ok.map((r) => r.generationLimit ? 1 : 0)),
    errors: rows.length - n,
    human: meanOfKeys(ok, (r) => r.human),
    bot: meanOfKeys(ok, (r) => r.bot),
  };
}

function groupBy<K extends string>(rows: ReadonlyArray<Row>, key: (r: Row) => K): Record<K, Array<Row>> {
  const out = {} as Record<K, Array<Row>>;
  for (const r of rows) {
    (out[key(r)] ??= []).push(r);
  }
  return out;
}

function statsBy<K extends string>(rows: ReadonlyArray<Row>, key: (r: Row) => K): Record<K, CellStats> {
  const groups = groupBy(rows, key);
  const out = {} as Record<K, CellStats>;
  for (const k of Object.keys(groups) as Array<K>) {
    out[k] = cellStats(groups[k]);
  }
  return out;
}

export function summarize(results: ReadonlyArray<Row>, seconds: number) {
  const a = results.filter((r) => r.study === 'A');
  const b = results.filter((r) => r.study === 'B');
  const errorSamples = [...new Set(results.filter((r) => r.error !== undefined).map((r) => r.error!.slice(0, 200)))].slice(0, 10);
  return {
    generatedAt: new Date().toISOString(),
    seconds,
    totalGames: results.length,
    errorSamples,
    studyA: {
      byDifficulty: statsBy(a, (r) => r.difficulty),
      byCorp: statsBy(a, (r) => r.humanCorp),
      byDifficultyAndCorp: statsBy(a, (r) => `${r.difficulty}|${r.humanCorp}`),
    },
    studyB: {
      byBotCorp: statsBy(b, (r) => r.botCorp ?? 'none'),
    },
  };
}
