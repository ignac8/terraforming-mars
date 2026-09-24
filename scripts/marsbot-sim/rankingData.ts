/**
 * Condenses a corporation ranking run (corpRanking.ts) into per-corporation statistics.
 *
 *   npx tsx scripts/marsbot-sim/rankingData.ts <results.live.jsonl> [out.json]
 *
 * Pace is MarsBot's score if the game had ended after a given generation (MarsBot's own
 * per-generation VP record). A game that ended earlier keeps its final score.
 */
import {readFileSync, writeFileSync} from 'fs';
import {GameResult} from './runGame';
import {ALL_AUTOMA_MANIFESTS} from '../../src/server/automa/corps/AllAutomaManifests';

type Row = GameResult & {draft: boolean};

const PACE_GENERATIONS = [8, 10, 12, 14, 16];
const MANIFEST_LABELS = ['Base', 'Prelude', 'Promo', 'Venus', 'Colonies', 'Turmoil'];

function mean(xs: ReadonlyArray<number>): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: ReadonlyArray<number>): number {
  const m = mean(xs);
  return xs.length > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)) : 0;
}

/** Half-width of the 95% interval for the mean. */
function ci(xs: ReadonlyArray<number>): number {
  return xs.length > 1 ? 1.96 * sd(xs) / Math.sqrt(xs.length) : 0;
}

function quantile(xs: ReadonlyArray<number>, q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) {
    return 0;
  }
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

function round(x: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

/** Score after `generation`, or the final score if the game ended before it. */
function vpAfter(r: Row, generation: number): number {
  const byGen = r.botVPByGeneration;
  return generation <= byGen.length ? byGen[generation - 1] : r.botVP;
}

function main() {
  const rows: Array<Row> = readFileSync(process.argv[2], 'utf8').split('\n')
    .filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
  const expansionOf = new Map<string, string>();
  ALL_AUTOMA_MANIFESTS.forEach((manifest, i) => {
    for (const name of Object.keys(manifest.corps)) {
      expansionOf.set(name, MANIFEST_LABELS[i]);
    }
  });

  const cells = new Map<string, Array<Row>>();
  for (const r of rows) {
    const key = `${r.draft}|${r.botCorp ?? ''}`;
    cells.set(key, [...(cells.get(key) ?? []), r]);
  }

  const variants = [true, false].map((draft) => {
    const baseline = new Map<number, Row>();
    for (const r of cells.get(`${draft}|`) ?? []) {
      baseline.set(r.seed, r);
    }
    const corps = [...cells.entries()]
      .filter(([key]) => key.startsWith(`${draft}|`))
      .map(([key, all]) => {
        const corp = key.split('|')[1];
        const ok = all.filter((r) => r.error === undefined);
        const finalVP = ok.map((r) => r.botVP);
        const pace: Record<string, {mean: number, ci: number, vsBase: number, vsBaseCI: number}> = {};
        for (const g of PACE_GENERATIONS) {
          const vp = ok.map((r) => vpAfter(r, g));
          const diffs = ok.filter((r) => baseline.has(r.seed)).map((r) => vpAfter(r, g) - vpAfter(baseline.get(r.seed)!, g));
          pace[g] = {mean: round(mean(vp)), ci: round(ci(vp), 2), vsBase: round(mean(diffs)), vsBaseCI: round(ci(diffs), 2)};
        }
        const curve = Array.from({length: 17}, (_, i) => round(mean(ok.map((r) => vpAfter(r, i + 1)))));
        const finished = ok.filter((r) => !r.generationLimit);
        return {
          corp: corp === '' ? null : corp,
          expansion: corp === '' ? null : expansionOf.get(corp) ?? '?',
          n: ok.length,
          errors: all.length - ok.length,
          pace,
          curve,
          finalVP: {
            mean: round(mean(finalVP)), ci: round(ci(finalVP), 2), sd: round(sd(finalVP)),
            median: round(quantile(finalVP, 0.5)), p10: round(quantile(finalVP, 0.1)), p90: round(quantile(finalVP, 0.9)),
          },
          finishedVP: round(mean(finished.map((r) => r.botVP))),
          endGeneration: round(mean(ok.map((r) => r.generationLimit ? r.generation - 1 : r.generation)), 2),
          finishedGeneration: round(mean(finished.map((r) => r.generation)), 2),
          limitRate: round(ok.filter((r) => r.generationLimit).length / Math.max(1, ok.length), 3),
          breakdown: Object.fromEntries(Object.keys(ok[0]?.bot ?? {}).map((k) =>
            [k, round(mean(ok.map((r) => (r.bot as Record<string, number>)[k])))])),
        };
      });
    return {draft, corps};
  });

  const out = JSON.stringify({games: rows.length, paceGenerations: PACE_GENERATIONS, variants}, null, 1);
  if (process.argv[3] !== undefined) {
    writeFileSync(process.argv[3], out);
  } else {
    console.log(out);
  }
}

main();
