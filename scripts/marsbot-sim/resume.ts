/**
 * Finishes an interrupted experiment run: replays only the configs missing from results.live.jsonl.
 *
 *   STUDY_B_DIFFICULTY=easy npx tsx scripts/marsbot-sim/resume.ts <gamesPerCell> <outDir>
 */
import {readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import {runParallel} from './parallel';
import {buildConfigs, StudyConfig} from './experiment';

const key = (c: StudyConfig) => [c.study, c.seed, c.humanCorp, c.difficulty, c.botCorp ?? 'none'].join('|');

async function main() {
  const perCell = Number(process.argv[2] ?? 500);
  const outDir = process.argv[3];
  const live = join(outDir, 'results.live.jsonl');
  const done = new Set(readFileSync(live, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => key(JSON.parse(l))));
  const missing = buildConfigs(perCell).filter((c) => !done.has(key(c)));
  process.stderr.write(`${done.size} done, ${missing.length} missing\n`);
  await runParallel(missing, (n) => n % 250 === 0 && process.stderr.write(`${n}/${missing.length}\n`), live);
  const all = readFileSync(live, 'utf8');
  writeFileSync(join(outDir, 'results.jsonl'), all);
  process.stderr.write('Wrote results.jsonl\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
