/**
 * Runs the full MarsBot difficulty study and writes raw results (JSON Lines) plus a summary (JSON).
 *
 *   npx tsx scripts/marsbot-sim/experiment.ts [gamesPerCell] [outDir]
 *
 * Study A: every human corporation against every MarsBot difficulty (MarsBot without a corporation).
 * Study B: MarsBot playing each of its 12 base-game corporations (Rulebook B) at one difficulty, plus a
 *          no-corporation baseline, with the human corporation rotating.
 *
 * Seeds are shared across cells (game i of every cell uses seed i), so differences between cells
 * are not muddied by one cell simply getting luckier deals.
 */
import {mkdirSync, writeFileSync} from 'fs';
import {join} from 'path';
import {runParallel} from './parallel';
import {Difficulty, GameConfig, GameResult} from './runGame';
import {BOT_BASE_CORPS, HUMAN_CORPS} from './corps';
import {summarize} from './summarize';

const ALL_DIFFICULTIES: ReadonlyArray<Difficulty> = ['easy', 'normal', 'hard', 'brutal'];
/** DIFFICULTIES=easy,normal limits study A; STUDY_B_DIFFICULTY sets study B's level (default normal). */
const DIFFICULTIES = (process.env.DIFFICULTIES?.split(',') as Array<Difficulty> | undefined) ?? ALL_DIFFICULTIES;
const STUDY_B_DIFFICULTY = (process.env.STUDY_B_DIFFICULTY ?? 'normal') as Difficulty;

export type StudyConfig = GameConfig & {study: 'A' | 'B'};

export function buildConfigs(perCell: number): Array<StudyConfig> {
  const configs: Array<StudyConfig> = [];
  for (const difficulty of DIFFICULTIES) {
    for (const humanCorp of HUMAN_CORPS) {
      for (let i = 0; i < perCell; i++) {
        configs.push({study: 'A', seed: i, humanCorp, difficulty});
      }
    }
  }
  for (const botCorp of [undefined, ...BOT_BASE_CORPS]) {
    const humanCorps = HUMAN_CORPS.filter((c) => c !== botCorp);
    for (let i = 0; i < perCell; i++) {
      configs.push({study: 'B', seed: 1_000_000 + i, humanCorp: humanCorps[i % humanCorps.length], difficulty: STUDY_B_DIFFICULTY, botCorp});
    }
  }
  return configs;
}

async function main() {
  const perCell = Number(process.argv[2] ?? 500);
  const outDir = process.argv[3] ?? join(__dirname, 'out');
  mkdirSync(outDir, {recursive: true});
  const configs = buildConfigs(perCell);

  const started = Date.now();
  let lastReport = 0;
  const results = await runParallel(configs, (done) => {
    if (done - lastReport >= 2000 || done === configs.length) {
      lastReport = done;
      const secs = (Date.now() - started) / 1000;
      process.stderr.write(`${done}/${configs.length} games, ${secs.toFixed(0)}s\n`);
    }
  }, join(outDir, 'results.live.jsonl')) as Array<GameResult & {study: 'A' | 'B'}>;

  writeFileSync(join(outDir, 'results.jsonl'), results.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const summary = summarize(results, (Date.now() - started) / 1000);
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  process.stderr.write(`Wrote ${results.length} results to ${outDir}\n`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
