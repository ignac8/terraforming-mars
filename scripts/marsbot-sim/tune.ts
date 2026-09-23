/** Compares strategy variants against Normal MarsBot to pick the script's default knobs. */
import {runParallel} from './parallel';
import {GameConfig} from './runGame';
import {Strategy} from './ScriptedPlayer';
import {LookaheadOptions} from './LookaheadPlayer';
import {HUMAN_CORPS} from './corps';

const variants: Record<string, Partial<Strategy> & {lookahead?: Partial<LookaheadOptions>}> = JSON.parse(process.argv[2] ?? '{"default": {}}');
const gamesPerVariant = Number(process.argv[3] ?? 120);
const seedBase = Number(process.argv[4] ?? 100000);

async function main() {
  const configs: Array<GameConfig & {variant: string}> = [];
  for (const [variant, {lookahead, ...strategy}] of Object.entries(variants)) {
    for (let i = 0; i < gamesPerVariant; i++) {
      configs.push({variant, seed: seedBase + i, humanCorp: HUMAN_CORPS[i % HUMAN_CORPS.length], difficulty: (process.env.DIFF ?? 'normal') as GameConfig['difficulty'], strategy, lookahead});
    }
  }
  const started = Date.now();
  const results = await runParallel(configs, (done) => {
    process.stderr.write(`${done}/${configs.length} games, ${((Date.now() - started) / 1000).toFixed(0)}s\n`);
  });
  for (const variant of Object.keys(variants)) {
    const rs = results.filter((r) => (r as any).variant === variant);
    const n = rs.length;
    const wins = rs.filter((r) => r.humanWon).length;
    const margin = rs.reduce((a, r) => a + r.humanVP - r.botVP, 0) / n;
    const gen = rs.reduce((a, r) => a + r.generation, 0) / n;
    const hvp = rs.reduce((a, r) => a + r.humanVP, 0) / n;
    const bvp = rs.reduce((a, r) => a + r.botVP, 0) / n;
    const errs = rs.filter((r) => r.error !== undefined).length;
    const avg = (f: (r: typeof rs[number]) => number) => (rs.reduce((a, r) => a + f(r), 0) / n).toFixed(1);
    if (process.env.BREAKDOWN) {
      console.log(`  human tr ${avg((r) => r.human.tr)} ms ${avg((r) => r.human.milestones)} aw ${avg((r) => r.human.awards)} gr ${avg((r) => r.human.greenery)} city ${avg((r) => r.human.city)} cards ${avg((r) => r.human.cards)} played ${avg((r) => r.human.cardsPlayed)} bought ${avg((r) => r.scriptStats.cardsBought)} sp ${avg((r) => r.scriptStats.standardProjects)}`);
      console.log(`  bot   tr ${avg((r) => r.bot.tr)} ms ${avg((r) => r.bot.milestones)} aw ${avg((r) => r.bot.awards)} gr ${avg((r) => r.bot.greenery)} city ${avg((r) => r.bot.city)} mc ${avg((r) => r.bot.mcToVP)} cardVP ${avg((r) => r.bot.cardVP)} other ${avg((r) => r.bot.other)}`);
    }
    console.log(`${variant.padEnd(16)} win ${(100 * wins / n).toFixed(1)}%  margin ${margin.toFixed(1)}  human ${hvp.toFixed(1)} bot ${bvp.toFixed(1)}  gen ${gen.toFixed(1)}  errors ${errs}`);
  }
  const errors = results.filter((r) => r.error !== undefined).map((r) => r.error!.slice(0, 160));
  const counts = new Map<string, number>();
  errors.forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1));
  [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([e, c]) => console.log(c, e));
}
main();
