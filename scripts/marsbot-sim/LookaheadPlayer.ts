/**
 * A stronger player that searches at the main action menu instead of following a fixed order.
 *
 * For each candidate move it copies the game (serialize + deserialize), shuffles every hidden
 * deck in the copy so it cannot peek at upcoming cards, makes the move, and plays the rest of the
 * game out with the greedy ScriptedPlayer against MarsBot. It picks the move with the best average
 * final point margin. All candidates share the same shuffles, so they are compared on equal luck.
 *
 * Other decisions (card purchases, tile placement, targets) still use the greedy script.
 */
import {Game} from '../../src/server/Game';
import {IPlayer} from '../../src/server/IPlayer';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {DEFAULT_STRATEGY, ScriptedPlayer, Strategy} from './ScriptedPlayer';

export type LookaheadOptions = {
  /** Rollouts per candidate move. */
  rollouts: number,
  /** How many of the heuristically best playable cards to consider. */
  maxCards: number,
};

export const DEFAULT_LOOKAHEAD: LookaheadOptions = {rollouts: 2, maxCards: 4};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(array: Array<T>, random: () => number): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

const MAX_ROLLOUT_INPUTS = 3000;

export class LookaheadPlayer extends ScriptedPlayer {
  public readonly searchStats = {decisions: 0, rollouts: 0, rolloutErrors: 0};
  private decisionCounter = 0;

  constructor(
    player: IPlayer,
    corporation: CardName,
    strategy: Strategy = DEFAULT_STRATEGY,
    private readonly options: LookaheadOptions = DEFAULT_LOOKAHEAD,
    private readonly seed: number = 0) {
    super(player, corporation, strategy);
  }

  protected override respondMainAction(menu: OrOptions): InputResponse {
    const candidates = this.mainActionCandidates(menu, this.options.maxCards);
    if (candidates.length <= 1) {
      return candidates[0]?.response ?? super.respondMainAction(menu);
    }
    this.searchStats.decisions++;
    this.decisionCounter++;
    const snapshot = JSON.stringify((this.game as Game).serialize());

    let best: InputResponse | undefined;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      let total = 0;
      let count = 0;
      for (let r = 0; r < this.options.rollouts; r++) {
        const score = this.rollout(snapshot, candidate.response, this.seed * 1_000_003 + this.decisionCounter * 101 + r);
        if (score !== undefined) {
          total += score;
          count++;
        }
      }
      if (count > 0 && total / count > bestScore) {
        bestScore = total / count;
        best = candidate.response;
      }
    }
    return best ?? super.respondMainAction(menu);
  }

  /** Final (our VP - MarsBot VP) after making `move` in a copy of the game, or undefined if the copy broke. */
  private rollout(snapshot: string, move: InputResponse, shuffleSeed: number): number | undefined {
    this.searchStats.rollouts++;
    try {
      const game = Game.deserialize(JSON.parse(snapshot));
      const random = mulberry32(shuffleSeed);
      shuffleInPlace(game.projectDeck.drawPile, random);
      const marsBot = game.automaHooks!.marsBot;
      shuffleInPlace(marsBot.actionDeck, random);
      shuffleInPlace(marsBot.bonusDeck.drawPile, random);

      const human = game.players[0];
      const script = new ScriptedPlayer(human, human.pickedCorporationCard!.name, this.strategy);
      human.process(move);
      while (game.phase !== Phase.END) {
        const input = human.getWaitingFor();
        if (input === undefined || script.stats.inputs > MAX_ROLLOUT_INPUTS) {
          throw new Error('rollout stuck');
        }
        human.process(script.respond(input));
      }
      const humanVP = human.getVictoryPoints().total;
      const botVP = marsBot.getVictoryPoints().total;
      const lost = marsBot.isInstantWin() || botVP >= humanVP;
      // Winning matters more than the size of the margin.
      return humanVP - botVP + (lost ? 0 : 10);
    } catch {
      this.searchStats.rolloutErrors++;
      return undefined;
    }
  }
}
