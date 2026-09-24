/**
 * Plays one complete solo game of the scripted player against MarsBot, headless and in-process.
 */
import {GameLoader} from '../../src/server/database/GameLoader';
import {IGameLoader} from '../../src/server/database/IGameLoader';
import {Database} from '../../src/server/database/Database';
import {IDatabase} from '../../src/server/database/IDatabase';
import {globalInitialize} from '../../src/server/globalInitialize';
import {Game} from '../../src/server/Game';
import {Player} from '../../src/server/Player';
import {GameId, PlayerId, SpectatorId} from '../../src/common/Types';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {newCorporationCard} from '../../src/server/createCard';
import {MarsBotCorpResolver} from '../../src/server/automa/corps/MarsBotCorpResolver';
import {getMarsBotCorp} from '../../src/server/automa/corps/MarsBotCorpRegistry';
import {DEFAULT_STRATEGY, ScriptedPlayer, Strategy} from './ScriptedPlayer';
import {DEFAULT_LOOKAHEAD, LookaheadOptions, LookaheadPlayer} from './LookaheadPlayer';
import {PassingPlayer} from './PassingPlayer';
import {GameOptions} from '../../src/server/game/GameOptions';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'brutal';

export type GameConfig = {
  seed: number,
  humanCorp: CardName,
  difficulty: Difficulty,
  /** MarsBot's corporation (Rulebook B). Undefined plays MarsBot without a corporation. */
  botCorp?: CardName,
  /** Overrides for the scripted player's knobs. */
  strategy?: Partial<Strategy>,
  /** Use the searching player instead of the greedy script, with these settings. */
  lookahead?: Partial<LookaheadOptions>,
  /** 'passing' plays an opponent that passes every turn instead of the greedy script. */
  opponent?: 'scripted' | 'passing',
  /** Game options on top of the simulator's base (Corporate Era only). */
  options?: Partial<GameOptions>,
};

export type GameResult = GameConfig & {
  /** True when the scripted player won. Ties go to MarsBot. */
  humanWon: boolean,
  humanVP: number,
  botVP: number,
  generation: number,
  /** True when MarsBot won by reaching the generation limit. */
  generationLimit: boolean,
  /** True when all three Mars global parameters were maxed at the end. */
  marsTerraformed: boolean,
  human: {tr: number, milestones: number, awards: number, greenery: number, city: number, cards: number, cardsPlayed: number},
  bot: {tr: number, milestones: number, awards: number, greenery: number, city: number, mcToVP: number, cardVP: number, other: number},
  /** MarsBot's score if the game had ended after each generation (index 0 = after generation 1). */
  botVPByGeneration: Array<number>,
  /** The scripted player's score after each generation. */
  humanVPByGeneration: Array<number>,
  scriptStats: ScriptedPlayer['stats'],
  searchStats?: LookaheadPlayer['searchStats'],
  error?: string,
};

let initialized = false;
function initialize() {
  if (initialized) {
    return;
  }
  // Games are never persisted during a simulation.
  const noopLoader = {saveGame: () => Promise.resolve(), completeGame: () => Promise.resolve(), mark: () => {}} as unknown as IGameLoader;
  GameLoader.getInstance = () => noopLoader;
  const noopDatabase = {saveGameResults: () => {}, markFinished: () => Promise.resolve()} as unknown as IDatabase;
  Database.getInstance = () => noopDatabase;
  globalInitialize();
  // Force the requested MarsBot corporation instead of a random one.
  const originalSelect = MarsBotCorpResolver.selectCorp;
  MarsBotCorpResolver.selectCorp = (humanCorpName, gameOptions, rng) => {
    // Draw the random corporation anyway, so every forced corporation sees the same random stream.
    const random = originalSelect(humanCorpName, gameOptions, rng);
    if (forcedBotCorp !== undefined) {
      const corp = getMarsBotCorp(forcedBotCorp);
      if (corp === undefined) {
        throw new Error(`Unknown MarsBot corporation ${forcedBotCorp}`);
      }
      return corp;
    }
    return random;
  };
  initialized = true;
}
let forcedBotCorp: CardName | undefined;

const MAX_INPUTS = 5000;

/** Game seeds are fractions in [0, 1); spread integer seeds across that range. */
function seedFraction(seed: number): number {
  return (Math.imul(seed + 1, 2654435761) >>> 0) / 4294967296;
}

export function runGame(config: GameConfig): GameResult {
  initialize();
  forcedBotCorp = config.botCorp;

  const id = `sim-${config.seed}`;
  const human = new Player('Scripted', 'blue', false, 0, `p-${id}` as PlayerId);
  const game = Game.newInstance(`g-${id}` as GameId, [human], human, `s-${id}` as SpectatorId, {
    automaOption: true,
    automaDifficulty: config.difficulty,
    automaCorpOption: config.botCorp !== undefined,
    corporateEra: true,
    ...config.options,
  }, seedFraction(config.seed));

  // Deal the requested corporation to the human.
  if (!human.dealtCorporationCards.some((c) => c.name === config.humanCorp)) {
    const corp = newCorporationCard(config.humanCorp);
    if (corp === undefined) {
      throw new Error(`Unknown corporation ${config.humanCorp}`);
    }
    human.dealtCorporationCards[0] = corp;
  }

  const strategy = {...DEFAULT_STRATEGY, ...config.strategy};
  const script = config.opponent === 'passing' ?
    new PassingPlayer(human, config.humanCorp) :
    config.lookahead === undefined ?
      new ScriptedPlayer(human, config.humanCorp, strategy) :
      new LookaheadPlayer(human, config.humanCorp, strategy, {...DEFAULT_LOOKAHEAD, ...config.lookahead}, config.seed);
  let error: string | undefined;
  try {
    while (game.phase !== Phase.END) {
      const input = human.getWaitingFor();
      if (input === undefined) {
        throw new Error(`Human has nothing to do in phase ${game.phase}, generation ${game.generation}`);
      }
      if (script.stats.inputs > MAX_INPUTS) {
        throw new Error('Too many inputs; the script is probably looping');
      }
      const response = script.respond(input);
      try {
        human.process(response);
      } catch (e) {
        script.stats.errors++;
        throw new Error(`Engine rejected ${JSON.stringify(response).slice(0, 200)} for ${input.constructor.name}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    error = (e as Error).message;
  }

  const marsBot = game.automaHooks!.marsBot;
  const botVP = marsBot.getVictoryPoints();
  const humanVP = human.getVictoryPoints();
  const generationLimit = marsBot.isInstantWin();
  return {
    ...config,
    humanWon: error === undefined && !generationLimit && humanVP.total > botVP.total,
    humanVP: humanVP.total,
    botVP: botVP.total,
    generation: game.generation,
    generationLimit,
    marsTerraformed: game.marsIsTerraformed(),
    human: {
      tr: humanVP.terraformRating,
      milestones: humanVP.milestones,
      awards: humanVP.awards,
      greenery: humanVP.greenery,
      city: humanVP.city,
      cards: humanVP.victoryPoints,
      cardsPlayed: human.playedCards.length,
    },
    bot: {
      tr: botVP.terraformRating,
      milestones: botVP.milestones,
      awards: botVP.awards,
      greenery: botVP.greenery,
      city: botVP.cityAdjacentGreenery,
      mcToVP: botVP.mcToVP,
      cardVP: botVP.cardVP,
      other: botVP.total - botVP.terraformRating - botVP.milestones - botVP.awards - botVP.greenery - botVP.cityAdjacentGreenery - botVP.mcToVP - botVP.cardVP,
    },
    botVPByGeneration: [...marsBot.vpByGeneration],
    humanVPByGeneration: [...human.victoryPointsByGeneration],
    scriptStats: script.stats,
    searchStats: script instanceof LookaheadPlayer ? script.searchStats : undefined,
    error,
  };
}
