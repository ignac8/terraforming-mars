import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {cast} from '@/common/utils/utils';
import {IGame} from '@/server/IGame';
import {AutomaGameHooks} from '@/server/automa/AutomaGameHooks';
import {MarsBot} from '@/server/automa/MarsBot';
import {MarsBotCorp} from '@/server/automa/MarsBotCorp';
import {
  clearMarsBotCorpRegistry, restoreMarsBotCorpRegistry,
  getMarsBotCorp,
} from '@/server/automa/corps/MarsBotCorpRegistry';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {IPlayer} from '@/server/IPlayer';
import {DifficultyLevel, TrackDefinition} from '@/common/automa/AutomaTypes';
import {SeededRandom} from '@/common/utils/Random';
import {OrOptions} from '@/server/inputs/OrOptions';
import {testGame, TestGameOptions} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';

export type AutomaGame = {game: IGame, human: TestPlayer, marsBot: MarsBot};

/**
 * Creates a 1-player game on the Tharsis board with MarsBot at Normal difficulty.
 *
 * `options` overrides any game option.
 */
export function createAutomaGame(options: Partial<TestGameOptions> = {}): AutomaGame {
  const [game, human] = testGame(1, {
    automa: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
    ...options,
  });
  expect(game.automaHooks?.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

/**
 * Creates a MarsBot on the board `tracks` for `game` without running its setup.
 *
 * The game's own players stay as they are.
 */
export function standaloneMarsBot(game: IGame, player: IPlayer, humanPlayer: IPlayer, tracks: ReadonlyArray<TrackDefinition>, difficulty: DifficultyLevel = 'normal'): MarsBot {
  return new MarsBot(game, player, humanPlayer, tracks, difficulty, new SeededRandom(0));
}

/** Creates a Venus game in which MarsBot has run the setup of `corpName`, for the corporation FAQ (rulebook B, p.4). */
export function createCorpFaqGame(corpName: CardName): AutomaGame {
  const [game, human] = testGame(1, {automa: true, expansions: {venus: true}, boardName: BoardName.THARSIS});
  const marsBot = game.automaHooks!.marsBot;
  marsBot.setCorpAndSetup(getMarsBotCorp(corpName)!);
  return {game, human, marsBot};
}

/**
 * Copies `corp` without its ongoing effect.
 *
 * The copy keeps what the card prints, and what it does at setup, at the start of a generation and before the
 * action phase.
 */
export function withoutEffect(corp: MarsBotCorp): MarsBotCorp {
  return {
    name: corp.name,
    description: corp.description,
    tags: corp.tags,
    requiredExpansions: corp.requiredExpansions,
    draftPriority: corp.draftPriority,
    actionDeckBonusCard: corp.actionDeckBonusCard,
    trackCubes: corp.trackCubes,
    trackCubesTriggerEveryAdvance: corp.trackCubesTriggerEveryAdvance,
    setup: corp.setup?.bind(corp),
    roundStart: corp.roundStart?.bind(corp),
    beforeActionPhase: corp.beforeActionPhase?.bind(corp),
  };
}

/**
 * Runs the setup of the corporation `name` as it is and with its ongoing effect removed, in identical games.
 *
 * The difference between the two is what the effect made of the starting tags, which resolve as a revealed card
 * (rulebook B, setup step 4).
 */
export function setupWithAndWithoutEffect(name: CardName) {
  const corp = getMarsBotCorp(name)!;
  const run = (c: MarsBotCorp) => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(c);
    return {
      mc: marsBot.megacredits,
      tr: marsBot.player.terraformRating,
      events: marsBot.marsBotBoard.tracks[2].position,
    };
  };
  return {withEffect: run(corp), without: run(withoutEffect(corp))};
}

/** Returns the MarsBot of a game made with `automa: true`. */
export function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

/** Answers the player's choice between the plants on MarsBot's corporation card (0) and its other sources (1). */
export function chooseSource(game: IGame, human: TestPlayer, index: number): void {
  runAllActions(game);
  cast(human.popWaitingFor(), OrOptions).options[index].process({type: 'option'}, human);
  runAllActions(game);
}

/** Creates a project card that has only the fields a corporation's effect reads: tags, cost, requirements and printed VP. */
export function fakeCard(name: string, opts: {tags?: Array<Tag>, cost?: number, requirements?: boolean, victoryPoints?: number} = {}): IProjectCard {
  return {
    name: name as CardName,
    tags: opts.tags ?? [],
    cost: opts.cost ?? 0,
    requirements: opts.requirements ? [{oceans: 1}] : [],
    getVictoryPoints: () => opts.victoryPoints ?? 0,
  } as unknown as IProjectCard;
}

/**
 * Puts every MarsBot corporation back in the registry, however an earlier test left it.
 *
 * A spec whose tests read the registry (`getMarsBotCorp`, loading a saved game) calls it from `beforeEach`.
 * One whose tests replace the registry's contents calls it from `afterEach` too.
 */
export function resetCorpRegistry(): void {
  clearMarsBotCorpRegistry();
  restoreMarsBotCorpRegistry();
}
