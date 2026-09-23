/** Summarizes a live results file (JSON Lines) while a run is still going. */
import {readFileSync} from 'fs';
import {cellStats} from './summarize';
import {GameResult} from './runGame';

const rows = readFileSync(process.argv[2], 'utf8').split('\n').filter((l) => l.trim() !== '')
  .map((l) => ({...JSON.parse(l), study: 'A'})) as Array<GameResult & {study: 'A'}>;
const s = cellStats(rows);
console.log(`${rows.length} games: win ${(100 * s.winRate).toFixed(0)}% margin ${s.margin.toFixed(1)} ±${s.marginCI.toFixed(1)}` +
  ` player ${s.humanVP.toFixed(1)} MarsBot ${s.botVP.toFixed(1)} gen ${s.generation.toFixed(1)} errors ${s.errors}`);
