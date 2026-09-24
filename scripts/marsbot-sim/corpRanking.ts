/**
 * Ranks MarsBot's corporations: every corporation plays the same seeds at one difficulty against
 * an opponent that only passes, with the draft on and off, under the fork's default game setup.
 *
 *   npx tsx scripts/marsbot-sim/corpRanking.ts [gamesPerCorp] [outDir]
 *
 * Game i of every corporation uses seed i, so the corporations are compared on the same deals.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import {runParallel} from './parallel';
import {Difficulty, GameConfig, GameResult} from './runGame';
import {CardName} from '../../src/common/cards/CardName';
import {GameOptions} from '../../src/server/game/GameOptions';
import {getAllMarsBotCorps} from '../../src/server/automa/corps/MarsBotCorpRegistry';

const DIFFICULTY = (process.env.DIFFICULTY ?? 'normal') as Difficulty;

/** The create-game form's defaults for a MarsBot game (defaultCreateGameModel.ts). */
export const FORK_DEFAULTS: Partial<GameOptions> = {
  corporateEra: true,
  preludeExtension: true,
  prelude2Expansion: true,
  promoCardsOption: true,
  venusNextExtension: true,
  coloniesExtension: true,
  turmoilExtension: true,
  politicalAgendasExtension: 'Standard',
  automaTurmoilTRReduction: 10,
  automaTurmoilSetupDelegates: 0,
  automaNoGenerationLimit: false,
};

export type RankingConfig = GameConfig & {draft: boolean};

export function buildConfigs(perCorp: number): Array<RankingConfig> {
  const corps: Array<CardName | undefined> = [undefined, ...getAllMarsBotCorps().map((c) => c.name as CardName)];
  const configs: Array<RankingConfig> = [];
  for (const draft of [true, false]) {
    for (const botCorp of corps) {
      for (let i = 0; i < perCorp; i++) {
        configs.push({
          draft, seed: i, botCorp, difficulty: DIFFICULTY, opponent: 'passing',
          humanCorp: CardName.BEGINNER_CORPORATION,
          options: {...FORK_DEFAULTS, draftVariant: draft},
        });
      }
    }
  }
  return configs;
}

function key(c: RankingConfig): string {
  return `${c.draft}|${c.botCorp ?? ''}|${c.seed}`;
}

async function main() {
  const perCorp = Number(process.argv[2] ?? 500);
  const outDir = process.argv[3] ?? join(__dirname, 'out-ranking');
  mkdirSync(outDir, {recursive: true});
  const liveFile = join(outDir, 'results.live.jsonl');
  // Resume: skip games already in the live file.
  const done = new Set<string>();
  if (existsSync(liveFile)) {
    for (const line of readFileSync(liveFile, 'utf8').split('\n')) {
      if (line.trim() !== '') {
        done.add(key(JSON.parse(line)));
      }
    }
  }
  const configs = buildConfigs(perCorp).filter((c) => !done.has(key(c)));
  process.stderr.write(`${configs.length} games to play (${done.size} already done)\n`);

  const started = Date.now();
  let lastReport = 0;
  await runParallel(configs, (n) => {
    if (n - lastReport >= 2000 || n === configs.length) {
      lastReport = n;
      process.stderr.write(`${n}/${configs.length} games, ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
    }
  }, liveFile) as Array<GameResult & {draft: boolean}>;
  writeFileSync(join(outDir, 'config.json'), JSON.stringify({perCorp, difficulty: DIFFICULTY, options: FORK_DEFAULTS,
    humanCorp: CardName.BEGINNER_CORPORATION, seconds: (Date.now() - started) / 1000}, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
