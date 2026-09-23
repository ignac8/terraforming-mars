/** Runs a list of game configs across worker processes and returns all results. */
import {spawn} from 'child_process';
import {writeFileSync} from 'fs';
import {cpus, tmpdir} from 'os';
import {join} from 'path';
import {GameConfig, GameResult} from './runGame';

export async function runParallel(configs: ReadonlyArray<GameConfig>, onProgress?: (done: number) => void): Promise<Array<GameResult>> {
  const file = join(tmpdir(), `marsbot-sim-${process.pid}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(configs));
  const shards = Math.max(1, cpus().length);
  const results: Array<GameResult> = [];
  await Promise.all(Array.from({length: shards}, (_, shard) => new Promise<void>((resolve, reject) => {
    const child = spawn('npx', ['tsx', join(__dirname, 'batch.ts'), file, String(shard), String(shards)], {stdio: ['ignore', 'pipe', 'inherit']});
    let buffer = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        results.push(JSON.parse(buffer.slice(0, nl)));
        buffer = buffer.slice(nl + 1);
        onProgress?.(results.length);
      }
    });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`worker ${shard} exited with ${code}`)));
  })));
  return results;
}
