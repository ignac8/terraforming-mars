import prometheus from '@prometheus-io/client';
import {Game} from '../Game';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {SerializedGame} from '../SerializedGame';
import {Database} from '../database/Database';
import {GameLoader} from '../database/GameLoader';
import {forgetReplay, getReplayMoves} from '../replay/ReplayService';
import {loadSandboxGame} from '../replay/sandbox';
import {RouteError} from '../routes/RouteError';
import {canRewind} from './access';
import {readRebuildSaves, replayToSave, ReplayResult} from './rebuild';
import {RewindRecord} from './RewindRecord';
import {shuffleHiddenPiles} from './shuffleHiddenPiles';
import {Phase} from '../../common/Phase';
import {Timer} from '../../common/Timer';
import {GameId} from '../../common/Types';
import {RewindCards} from '../../common/replay/ReplayModel';
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

// Games with a rewind in progress.
const rewinding = new Set<GameId>();

/**
 * Makes `game` as it was at `saveId` the live game, written as a new save after every existing one.
 * Throws a RouteError when refused; the live game, its rows and the cache are then unchanged.
 */
export async function rewindGame(game: IGame, player: IPlayer, saveId: number, cards: RewindCards): Promise<IGame> {
  if (!canRewind(game, player.id)) {
    throw RouteError.forbidden();
  }
  if (rewinding.has(game.id)) {
    throw RouteError.badRequest('A rewind is already running.');
  }
  // The request took the game before an earlier rewind replaced it.
  if (game.retired) {
    throw RouteError.badRequest('This game was rewound. Refresh this page.');
  }
  rewinding.add(game.id);
  try {
    return await rewind(game, player, saveId, cards);
  } finally {
    rewinding.delete(game.id);
  }
}

async function rewind(live: IGame, player: IPlayer, saveId: number, cards: RewindCards): Promise<IGame> {
  // The list leaves out abandoned saves, saves that show no move, and compressed history.
  const history = await getReplayMoves(live, player.id);
  if (history.status !== 'available' || !history.moves.some((move) => move.saveId === saveId)) {
    throw RouteError.notFound('That move is not in this game\'s history.');
  }

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
    forgetReplay(live.id);
  }

  // The swap runs without an await, so no input reaches either game while it runs.
  const record: RewindRecord = {
    saveId: Math.max(live.lastSaveId, maxSaveId + 1),
    restoredSaveId: saveId,
    logStart: target.gameLog.length,
    logEnd: live.gameLog.length,
  };
  const swap: Swap = {live, player, record, cards};
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
    await GameLoader.getInstance().add(restored);
  } catch (e) {
    if (live.retired) {
      live.retired = false;
      // Its next save overwrites any row the attempt wrote.
      live.lastSaveId = Math.max(live.lastSaveId, record.saveId);
    }
    if (finished) {
      // Queues the game for compression again. Its results are not restored.
      await Database.getInstance().markFinished(live.id).catch((err) => console.warn(`rewind: unable to mark ${live.id} finished again`, err));
    }
    if (e instanceof RouteError) {
      throw e;
    }
    console.warn(`rewind: unable to restore save ${saveId} of ${live.id}`, e);
    throw RouteError.badRequest(UNRESTORABLE);
  }
  rewindMetrics.rebuilds.inc({result});
  if (finished) {
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

type Swap = {live: IGame, player: IPlayer, record: RewindRecord, cards: RewindCards};

/**
 * Makes the rebuilt `sandbox` the live game and writes it as the save `record.saveId`.
 *
 * It runs inside the sandbox's save of the moment, before play goes on, so it can't leave half a rewind.
 */
function promote(sandbox: Game, {live, player, record, cards}: Swap): void {
  sandbox.gameLog = [...live.gameLog];
  sandbox.gameAge = live.gameAge;
  const message = cards === 'shuffle' ?
    '${0} rewound the game to generation ${1} and shuffled the hidden piles' :
    '${0} rewound the game to generation ${1}';
  sandbox.log(message, (b) => b.player(sandbox.getPlayerById(player.id)).number(sandbox.generation));
  sandbox.rewinds = [...live.rewinds, record];
  // Open pages see a higher count and refresh.
  sandbox.undoCount = live.undoCount + 1;
  // This save is the result of the rewind, not of inputs.
  sandbox.inputsSinceSave = [];
  for (const p of sandbox.players) {
    const was = live.getPlayerById(p.id);
    const own = p.timer.serialize();
    const spent = was.timer.serialize();
    // Only closed intervals carry over, so no time counts twice.
    p.timer = Timer.deserialize({
      ...own,
      sumElapsed: spent.sumElapsed,
      afterFirstAction: spent.afterFirstAction,
      startedAt: own.running ? Date.now() : own.startedAt,
      lastStoppedAt: 0,
    });
    // Seats are claimed by loading a page, which a rewind does not take back.
    p.password = was.password;
  }
  sandbox.judgePassword = live.judgePassword;
  sandbox.lastSaveId = record.saveId;
  sandbox.isSandbox = false;
  live.retired = true;
  sandbox.save();
  // Play goes on to the next prompt before the hand-over. A save on the way, like the research
  // phase after a pass, comes after the moment, so it isn't written.
  sandbox.isSandbox = true;
}
