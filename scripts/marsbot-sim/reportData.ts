/**
 * Condenses a results file into the figures the report page shows.
 *
 *   npx tsx scripts/marsbot-sim/reportData.ts <results.jsonl> <out.json>
 */
import {readFileSync, writeFileSync} from 'fs';
import {cellStats, CellStats} from './summarize';
import {GameResult} from './runGame';

type Row = GameResult & {study: 'A' | 'B'};

function quantile(sorted: ReadonlyArray<number>, q: number): number {
  if (sorted.length === 0) {
    return NaN;
  }
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function compact(s: CellStats) {
  const r = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
  return {
    n: s.n, wins: s.wins, winRate: r(s.winRate, 4), winLow: r(s.winLow, 4), winHigh: r(s.winHigh, 4),
    margin: r(s.margin), marginCI: r(s.marginCI), humanVP: r(s.humanVP), botVP: r(s.botVP),
    generation: r(s.generation, 2), errors: s.errors,
    human: Object.fromEntries(Object.entries(s.human).map(([k, v]) => [k, r(v)])),
    bot: Object.fromEntries(Object.entries(s.bot).map(([k, v]) => [k, r(v)])),
  };
}

function group<K extends string>(rows: ReadonlyArray<Row>, key: (r: Row) => K): Map<K, Array<Row>> {
  const out = new Map<K, Array<Row>>();
  for (const row of rows) {
    const k = key(row);
    if (!out.has(k)) {
      out.set(k, []);
    }
    out.get(k)!.push(row);
  }
  return out;
}

/** MarsBot's final score by the generation the game ended in (only generations with 30+ games). */
function finalScoreByEndGeneration(rows: ReadonlyArray<Row>) {
  const out: Array<{generation: number, n: number, p25: number, median: number, p75: number, p90: number}> = [];
  for (const [generation, games] of [...group(rows, (r) => String(r.generation))].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    if (games.length < 30) {
      continue;
    }
    const scores = games.map((g) => g.botVP).sort((a, b) => a - b);
    out.push({
      generation: Number(generation), n: games.length,
      p25: quantile(scores, 0.25), median: quantile(scores, 0.5), p75: quantile(scores, 0.75), p90: quantile(scores, 0.9),
    });
  }
  return out;
}

function main() {
  const rows: Array<Row> = readFileSync(process.argv[2], 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
  const a = rows.filter((r) => r.study === 'A' && r.error === undefined);
  const b = rows.filter((r) => r.study === 'B' && r.error === undefined);

  const difficulties = ['easy', 'normal', 'hard', 'brutal'].filter((d) => a.some((r) => r.difficulty === d));
  const data = {
    generatedAt: new Date().toISOString(),
    totalGames: rows.length,
    errors: rows.filter((r) => r.error !== undefined).length,
    difficulties: difficulties.map((d) => {
      const games = a.filter((r) => r.difficulty === d);
      return {
        difficulty: d,
        overall: compact(cellStats(games)),
        byCorp: [...group(games, (r) => r.humanCorp)].map(([corp, g]) => ({corp, ...compact(cellStats(g))})),
        finalScoreByEndGeneration: finalScoreByEndGeneration(games),
      };
    }),
    botCorps: {
      difficulty: b[0]?.difficulty,
      byCorp: [...group(b, (r) => r.botCorp ?? 'none')].map(([corp, g]) => ({corp, ...compact(cellStats(g))})),
    },
  };
  writeFileSync(process.argv[3], JSON.stringify(data));
  console.log(`Wrote report data for ${rows.length} games`);
}

main();
