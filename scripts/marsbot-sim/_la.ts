import {runGame} from './runGame';
import {HUMAN_CORPS} from './corps';
const n = Number(process.argv[2] ?? 4);
const t = Date.now();
let wins = 0, margin = 0;
for (let i = 0; i < n; i++) {
  const r = runGame({seed: 7000 + i, humanCorp: HUMAN_CORPS[i % 12], difficulty: 'normal', lookahead: JSON.parse(process.env.LA ?? '{}')});
  wins += r.humanWon ? 1 : 0; margin += r.humanVP - r.botVP;
  console.log(JSON.stringify(r.searchStats), r.humanCorp, r.humanVP, r.botVP, r.generation, r.error ?? '', ((Date.now() - t) / 1000).toFixed(1) + 's');
}
console.log('wins', wins, 'of', n, 'margin', (margin / n).toFixed(1));
