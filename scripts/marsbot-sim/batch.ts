/**
 * Worker: reads an array of GameConfig from the JSON file in argv[2], plays the ones
 * whose index % argv[4] === argv[3], and prints one GameResult per line (JSON Lines).
 */
import {readFileSync} from 'fs';
import {GameConfig, runGame} from './runGame';

const configs: Array<GameConfig> = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const shard = Number(process.argv[3]);
const shards = Number(process.argv[4]);
// The engine logs warnings to the console; keep stdout for results only.
const write = process.stdout.write.bind(process.stdout);
console.log = console.warn = console.error = () => {};
configs.forEach((config, i) => {
  if (i % shards === shard) {
    write(JSON.stringify(runGame(config)) + '\n');
  }
});
