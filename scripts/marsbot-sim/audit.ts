/**
 * Where do MarsBot's points come from? Plays games at one difficulty and breaks down
 * MarsBot's TR gains by source and its city-adjacency points by greenery owner.
 *
 *   npx tsx scripts/marsbot-sim/audit.ts [games] [difficulty]
 */
import {runGame, Difficulty} from './runGame';
import {HUMAN_CORPS} from './corps';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {Board} from '../../src/server/boards/Board';

let game: IGame | undefined;
const originalNewInstance = Game.newInstance;
Game.newInstance = (...args: Parameters<typeof Game.newInstance>) => {
  game = originalNewInstance(...args);
  return game as Game;
};

const games = Number(process.argv[2] ?? 200);
const difficulty = (process.argv[3] ?? 'normal') as Difficulty;
const totals: Record<string, number> = {};
const add = (k: string, v: number) => totals[k] = (totals[k] ?? 0) + v;

for (let i = 0; i < games; i++) {
  const r = runGame({seed: 5000 + i, humanCorp: HUMAN_CORPS[i % HUMAN_CORPS.length], difficulty});
  const g = game!;
  const bot = g.automaHooks!.marsBot.player;
  add('botVP', r.botVP);
  add('humanVP', r.humanVP);
  add('generation', r.generation);
  add('botTRgain', bot.terraformRating - 20);
  for (const entry of g.gameLog) {
    const m = entry.message;
    const val = Number(entry.data[0]?.value ?? 0);
    if (m.startsWith('MarsBot gains ${0} TR') || /^MarsBot gains \d+ TR/.test(m)) {
      add('trIcons', Number(/gains (\d+) TR/.exec(m)?.[1] ?? val));
    }
  }
  add('botParamSteps', Object.values(bot.globalParameterSteps).reduce((a: number, b) => a + (b as number), 0));
  const cities = g.board.getCities(bot);
  add('botCities', cities.length);
  add('botGreeneries', g.board.getGreeneries(bot).length);
  add('humanCities', g.board.getCities(g.players[0]).length);
  add('humanGreeneries', g.board.getGreeneries(g.players[0]).length);
  for (const c of cities) {
    for (const adj of g.board.getAdjacentSpaces(c)) {
      if (Board.isGreenerySpace(adj)) {
        add(adj.player === bot ? 'adjOwnGreenery' : 'adjHumanGreenery', 1);
      }
    }
  }
  add('milestonesBot', r.bot.milestones / 5);
  add('milestonesHuman', r.human.milestones / 5);
  add('awardsBot', r.bot.awards / 5);
  add('awardsHuman', r.human.awards / 5);
}
for (const [k, v] of Object.entries(totals)) {
  console.log(k.padEnd(18), (v / games).toFixed(2));
}
