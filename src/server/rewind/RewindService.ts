import prometheus from '@prometheus-io/client';
import {Game} from '../Game';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {SerializedGame} from '../SerializedGame';
import {Database} from '../database/Database';
import {GameLoader} from '../database/GameLoader';
import {forgetReplay, historySaveIds} from '../replay/ReplayService';
import {loadSandboxGame} from '../replay/sandbox';
import {RouteError} from '../routes/RouteError';
import {canRewind} from './access';
import {readRebuildSaves, replayToSave, ReplayResult} from './rebuild';
import {activeRewinds, isAbandonedSave, RewindRecord} from './RewindRecord';
import {shuffleHiddenPiles} from './shuffleHiddenPiles';
import {withTableLock} from './tableLock';
import {Phase} from '../../common/Phase';
import {Timer} from '../../common/Timer';
import {RewindCards, RewindClocks} from '../../common/replay/ReplayModel';
import {UnseededRandom} from '../../common/utils/Random';

export const rewindMetrics = {
  rebuilds: new prometheus.Counter({
    name: 'rewind_rebuilds',
    help: 'Rewinds, by how the moment was rebuilt',
    labelNames: ['result'] as const,
    registers: [prometheus.register],
  }),
};

const UNRESTORABLE = 'That moment can\'t be restored. Nothing was changed.';
const UNLOADABLE = 'That moment can\'t be restored with this version of the game. Nothing was changed.';
const PICK_EARLIER = 'Pick an earlier move.';
const GAME_REWOUND = 'This game was rewound. Refresh this page.';

/** Who rewinds: the player of a solo game, the judge, or the player whose request a vote accepted. */
export type RewindActor = {kind: 'player', player: IPlayer} | {kind: 'judge'} | {kind: 'vote', requester: IPlayer};

export type RewindOptions = {
  cards: RewindCards;
  clocks: RewindClocks;
  /** True: the rewound game is frozen, whatever the live game was. Otherwise the live game's freeze carries over. */
  freeze?: boolean;
};

/** The most rewinds one game takes, of every kind. Past it a rewind is refused. */
export const MAX_REWINDS = 50;

/**
 * Makes the whole table as it was at `saveId` the live game, written as one new save after every existing one.
 * Takes the table lock synchronously on call. The caller decides who may do this. Throws a RouteError when refused;
 * the live game, its rows and the cache are then unchanged.
 */
export function rewindTable(game: IGame, saveId: number, options: RewindOptions, by: RewindActor): Promise<IGame> {
  return withTableLock(game.id, () => rewind(game, saveId, options, by));
}

/** The rewind of a solo or MarsBot game by its player, who keeps the time already spent. */
export async function rewindGame(game: IGame, player: IPlayer, saveId: number, cards: RewindCards): Promise<IGame> {
  if (!canRewind(game, player.id)) {
    throw RouteError.forbidden();
  }
  return await rewindTable(game, saveId, {cards, clocks: 'keep'}, {kind: 'player', player});
}

async function rewind(live: IGame, saveId: number, options: RewindOptions, by: RewindActor): Promise<IGame> {
  // The request took the game before an earlier rewind replaced it, or before a rollback or a reload did, which
  // leave the game they replace as it was.
  if (live.retired || !await GameLoader.getInstance().isServed(live)) {
    throw RouteError.badRequest(GAME_REWOUND);
  }
  // Every request reads the rewind records, so their number is bounded.
  if (live.rewinds.length >= MAX_REWINDS) {
    throw RouteError.badRequest('This game was rewound too many times.');
  }
  // The list leaves out saves that show no move, and compressed history. Only the judge's list has the abandoned
  // saves: a rewind to one brings its line back.
  const history = await historySaveIds(live, {undone: by.kind === 'judge'});
  if (history === undefined || !history.includes(saveId)) {
    throw RouteError.notFound('That move is not in this game\'s history.');
  }
  // The save that an active rewind restored is abandoned too, since that rewind's save stands for it, but a rewind to
  // it brings nothing back. Active stretches never overlap, so every other abandoned save brings moves back.
  const restoresUndone = isAbandonedSave(saveId, live.rewinds) && !activeRewinds(live.rewinds).some((r) => r.restoredSaveId === saveId);
  const {cards} = options;

  let saves: Array<SerializedGame>;
  let maxSaveId: number;
  try {
    saves = await readRebuildSaves(live, saveId);
    maxSaveId = Math.max(...await Database.getInstance().getSaveIds(live.id));
  } catch (e) {
    console.warn(`rewind: unable to read save ${saveId} of ${live.id}`, e);
    throw RouteError.badRequest(UNRESTORABLE);
  }
  const target = saves[saves.length - 1];
  // The lines the rewind hides are told apart by their place in the log, so it must be the whole log.
  if (live.gameLog.length < target.gameLog.length) {
    throw RouteError.badRequest(UNRESTORABLE);
  }
  if (target.phase === Phase.END) {
    throw RouteError.badRequest(PICK_EARLIER);
  }

  // Both ways to rebuild the moment are checked before anything changes.
  const copy = structuredClone(target);
  if (cards === 'shuffle') {
    shuffleHiddenPiles(copy, UnseededRandom.INSTANCE);
  }
  let loads = true;
  try {
    // E.g. the final greenery save when nobody can place one: loading it ends the game.
    if (loadSandboxGame(copy).phase === Phase.END) {
      throw RouteError.badRequest(PICK_EARLIER);
    }
  } catch (e) {
    if (e instanceof RouteError) {
      throw e;
    }
    console.warn(`rewind: save ${saveId} of ${live.id} does not load`, e);
    loads = false;
  }

  const finished = live.phase === Phase.END;
  let result: ReplayResult['outcome'] = 'no-replay';
  // Shuffled piles must be in place before the moment's own dealing runs, which a replay has done
  // already, so a shuffle always restores the save, and its replay only counts. A finished game
  // is reopened only when the rewind can succeed, so its replay is tried before the reopen.
  if (saves.length > 1 && (cards === 'shuffle' || finished)) {
    result = checkReplay(live, saveId, saves);
  }
  const replay = cards === 'same' && saves.length > 1 && result !== 'mismatch';
  if (!loads && !replay) {
    throw RouteError.badRequest(UNLOADABLE);
  }

  if (finished) {
    try {
      // Otherwise the finished mark could land after the reopen and undo it.
      await live.finishing;
      await Database.getInstance().reopenFinishedGame(live.id);
    } catch (e) {
      console.warn(`rewind: unable to reopen ${live.id}`, e);
      throw RouteError.badRequest(UNRESTORABLE);
    }
    // Finishing marked the game to leave memory, which would tear it down mid-play.
    GameLoader.getInstance().unmark(live.id);
    forgetReplay(live.id);
  }

  // The swap runs without an await, so no input reaches either game while it runs.
  const record: RewindRecord = {
    saveId: Math.max(live.lastSaveId, maxSaveId + 1),
    restoredSaveId: saveId,
    logStart: target.gameLog.length,
    logEnd: live.gameLog.length,
  };
  const swap: Swap = {live, by, record, options, target, restoresUndone};
  let restored: Game | undefined;
  try {
    if (replay) {
      const replayed = replayToSave(saves, (sandbox) => promote(sandbox, swap));
      result = replayed.outcome;
      if (replayed.outcome === 'replayed') {
        restored = replayed.game;
      } else {
        warnMismatch(live, saveId, replayed);
      }
    }
    if (restored === undefined) {
      if (!loads) {
        throw RouteError.badRequest(UNLOADABLE);
      }
      // Loading saves the moment again before it asks for input or deals, and promote runs inside that save.
      restored = Game.deserialize(copy, {sandbox: true, onSave: (sandbox, saved) => {
        if (saved.lastSaveId === saveId) {
          promote(sandbox, swap);
        }
      }});
      // Drafting asks again from the saved hands without saving first.
      if (!live.retired) {
        promote(restored, swap);
      }
    }
    restored.isSandbox = false;
    if (restored.phase === Phase.END) {
      throw new Error('the rebuilt game ended');
    }
    settleClocks(restored);
    await GameLoader.getInstance().add(restored);
    if (finished) {
      // Loading the finished game meanwhile, e.g. for a page that polls it, marked it again.
      GameLoader.getInstance().unmark(live.id);
    }
  } catch (e) {
    if (live.retired) {
      await restoreLive(swap);
    }
    if (finished) {
      // Queues the game for compression again, and writes back the results the reopen deleted.
      await Database.getInstance().markFinished(live.id).catch((err) => console.warn(`rewind: unable to mark ${live.id} finished again`, err));
      GameLoader.getInstance().mark(live.id);
      // Awaited: a retry's reopen deletes the results row, and must not land before this write.
      try {
        await live.saveGameResults();
      } catch (err) {
        console.warn(`rewind: unable to write the results of ${live.id} back`, err);
      }
      // A replay view read while the rebuilt game was the newest save holds that game.
      forgetReplay(live.id);
    }
    if (e instanceof RouteError) {
      throw e;
    }
    console.warn(`rewind: unable to restore save ${saveId} of ${live.id}`, e);
    throw RouteError.badRequest(UNRESTORABLE);
  }
  rewindMetrics.rebuilds.inc({result});
  if (restoresUndone) {
    console.log(`rewind: ${live.id} restores undone save ${saveId}`);
  }
  if (finished) {
    // A request that took the old, finished object during the hand-over can have listed its moves
    // before the rewind's save landed.
    forgetReplay(live.id);
  }
  return restored;
}

// Replays to the moment without changing anything, to learn whether the recording still matches.
function checkReplay(live: IGame, saveId: number, saves: ReadonlyArray<SerializedGame>): 'replayed' | 'mismatch' {
  let replayed: ReplayResult;
  try {
    replayed = replayToSave(saves);
  } catch (e) {
    replayed = {outcome: 'mismatch', reason: `play after save ${saveId} fails: ${e}`};
  }
  if (replayed.outcome === 'mismatch') {
    warnMismatch(live, saveId, replayed);
    return 'mismatch';
  }
  return 'replayed';
}

function warnMismatch(live: IGame, saveId: number, replayed: ReplayResult): void {
  console.warn(`rewind: the replay of ${live.id} to save ${saveId} does not match: ${replayed.reason}`);
}

type Swap = {
  live: IGame,
  by: RewindActor,
  record: RewindRecord,
  options: RewindOptions,
  /** The stored save of the moment. Its clocks are the moment's, which a replay's are not. */
  target: SerializedGame,
  /** The moment is on a line that an earlier rewind abandoned, which this rewind brings back. */
  restoresUndone: boolean,
  /** The write of the save `record.saveId`, once promote has started it. */
  written?: Promise<void>,
};

/**
 * Makes the live game live again after a swap that failed once promote had retired it.
 *
 * Promote may have written the rebuilt game as the newest save, so the live game is written over it,
 * after that write has settled, so the two can't land in the wrong order.
 */
async function restoreLive({live, record, written}: Swap): Promise<void> {
  await written?.catch(() => {});
  live.lastSaveId = record.saveId;
  live.retired = false;
  try {
    await live.save();
  } catch (e) {
    console.warn(`rewind: unable to write ${live.id} back as save ${record.saveId}`, e);
  }
}

/**
 * Makes the rebuilt `sandbox` the live game and writes it as the save `record.saveId`.
 *
 * It runs inside the sandbox's save of the moment, before play goes on, so it can't leave half a rewind.
 */
function promote(sandbox: Game, swap: Swap): void {
  const {live, by, record, options, target, restoresUndone} = swap;
  sandbox.gameLog = [...live.gameLog];
  sandbox.gameAge = live.gameAge;
  logRewind(sandbox, by, options.cards, restoresUndone);
  sandbox.rewinds = [...live.rewinds, record];
  // Open pages see a higher count and refresh.
  sandbox.undoCount = live.undoCount + 1;
  // This save is the result of the rewind, not of inputs.
  sandbox.inputsSinceSave = [];
  // The save carries the freeze, so a reload of it is frozen exactly when the game is. The sandbox
  // holds no vote, and the live game's vote is not copied.
  sandbox.frozen = options.freeze === true || live.frozen;
  // A player may ask for a rewind once per generation, so a rewind within the generation keeps who
  // has asked. A rewind into an earlier generation bars no one.
  sandbox.rewindRequestLimits = live.rewindRequestLimits?.generation === sandbox.generation ?
    structuredClone(live.rewindRequestLimits) :
    undefined;
  for (const [i, p] of sandbox.players.entries()) {
    const was = live.getPlayerById(p.id);
    // 'keep' counts the interval in progress too: under escape velocity it is time spent.
    // Every save lists the players in the same order.
    const kept = options.clocks === 'keep' ?
      {sumElapsed: was.timer.countedElapsed(), afterFirstAction: was.timer.serialize().afterFirstAction} :
      target.players[i].timer;
    // Nobody's clock runs until the hand-over settles who is asked.
    p.timer = Timer.deserialize({
      sumElapsed: kept.sumElapsed,
      afterFirstAction: kept.afterFirstAction,
      running: false,
      startedAt: 0,
      lastStoppedAt: 0,
    });
    // Seats are claimed by loading a page, which a rewind does not take back.
    p.password = was.password;
  }
  sandbox.judgePassword = live.judgePassword;
  sandbox.lastSaveId = record.saveId;
  sandbox.isSandbox = false;
  live.retired = true;
  swap.written = sandbox.save();
  // Play goes on to the next prompt before the hand-over. A save on the way, like the research
  // phase after a pass, comes after the moment, so it isn't written.
  sandbox.isSandbox = true;
}

/** Writes the line that marks the rewind, naming who did it. Only the judge brings back moves that a rewind undid. */
function logRewind(game: Game, by: RewindActor, cards: RewindCards, restoresUndone: boolean): void {
  const shuffled = cards === 'shuffle';
  if (restoresUndone && by.kind === 'judge') {
    game.log(shuffled ?
      'The judge brought back undone moves, rewound the game to generation ${0} and shuffled the hidden piles' :
      'The judge brought back undone moves and rewound the game to generation ${0}',
    (b) => b.number(game.generation));
    return;
  }
  switch (by.kind) {
  case 'player':
    game.log(shuffled ?
      '${0} rewound the game to generation ${1} and shuffled the hidden piles' :
      '${0} rewound the game to generation ${1}',
    (b) => b.player(game.getPlayerById(by.player.id)).number(game.generation));
    break;
  case 'judge':
    game.log(shuffled ?
      'The judge rewound the game to generation ${0} and shuffled the hidden piles' :
      'The judge rewound the game to generation ${0}',
    (b) => b.number(game.generation));
    break;
  case 'vote':
    game.log(shuffled ?
      '${0} rewound the game to generation ${1} after a unanimous vote and shuffled the hidden piles' :
      '${0} rewound the game to generation ${1} after a unanimous vote',
    (b) => b.player(game.getPlayerById(by.requester.id)).number(game.generation));
    break;
  }
}

/**
 * Starts the clocks of the players the restored game asks, from now. Promote stopped every clock, and a
 * prompt reached after it started its clock at the shared last stop time, which can lie anywhere.
 * A frozen game runs no clock.
 */
function settleClocks(game: IGame): void {
  for (const p of game.players) {
    p.timer = Timer.deserialize({...p.timer.serialize(), running: false, lastStoppedAt: 0});
    const prompt = p.getWaitingFor();
    if (!game.frozen && prompt !== undefined && !prompt.optional) {
      p.timer.resume();
    }
  }
}
