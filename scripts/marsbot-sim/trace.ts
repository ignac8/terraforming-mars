/**
 * Debugging aid: plays one game and prints a per-generation summary of both sides.
 *
 *   npx tsx scripts/marsbot-sim/trace.ts [seed] [humanCorp] [difficulty]
 *
 * Environment: HAND=1 lists the scripted player's hand each generation, LOG=1 prints the
 * full game log afterwards, STRAT='{"rushBonus": 5}' overrides strategy knobs.
 */
import {runGame, Difficulty} from './runGame';
import {CardName} from '../../src/common/cards/CardName';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';

let game: IGame | undefined;
const originalNewInstance = Game.newInstance;
Game.newInstance = (...args: Parameters<typeof Game.newInstance>) => {
  game = originalNewInstance(...args);
  return game as Game;
};

const originalProduction = (Game.prototype as any).gotoProductionPhase;
(Game.prototype as any).gotoProductionPhase = function(this: Game) {
  const h = this.players[0];
  const bot = this.automaHooks!.marsBot;
  console.log(`gen ${this.generation} T=${this.getTemperature()} O=${this.getOxygenLevel()} Oc=${this.board.getOceanSpaces().length}` +
    ` | human tr=${h.terraformRating} mc=${h.megaCredits} prod=${JSON.stringify(h.production.asUnits())} hand=${h.cardsInHand.length} played=${h.playedCards.length}` +
    ` | bot tr=${bot.player.terraformRating} mc=${bot.turnResolver.megacredits} tracks=${bot.marsBotBoard.tracks.map((t) => t.position).join(',')}`);
  if (process.env.HAND) {
    for (const c of h.cardsInHand) {
      console.log(`   hand: ${c.name} cost ${c.cost} playable ${h.canPlay(c)} reqs ${JSON.stringify(c.requirements)}`);
    }
  }
  return originalProduction.call(this);
};

const result = runGame({
  seed: Number(process.argv[2] ?? 1),
  humanCorp: (process.argv[3] ?? CardName.ECOLINE) as CardName,
  difficulty: (process.argv[4] ?? 'normal') as Difficulty,
  strategy: JSON.parse(process.env.STRAT ?? '{}'),
});
if (process.env.LOG && game !== undefined) {
  for (const entry of game.gameLog) {
    let text = entry.message;
    entry.data.forEach((d, i) => {
      text = text.replace('${' + i + '}', String(d.value));
    });
    console.log(text);
  }
}
console.log(JSON.stringify(result));
