import {Game} from '../Game';
import {IGame} from '../IGame';
import {PlayerInput} from '../PlayerInput';
import {SerializedGame} from '../SerializedGame';
import {Database} from '../database/Database';
import {Phase} from '../../common/Phase';
import {Timer} from '../../common/Timer';
import {RecordedInput} from './RecordedInput';
import {sameState, stateHash} from './stateHash';

/** The most inputs a rebuild replays. Past that it starts from a later save. */
export const MAX_REPLAYED_INPUTS = 100;

/** Reads the replay base and every save after it up to `saveId`, ascending. The last entry is the save of `saveId`. */
export async function readRebuildSaves(game: IGame, saveId: number): Promise<Array<SerializedGame>> {
  const database = Database.getInstance();
  const saveIds = new Set(await database.getSaveIds(game.id));
  // Newest first. A save's inputs are the ones that led to it from the save before.
  const saves = [await database.getGameVersion(game.id, saveId)];
  let replayed = 0;
  for (let k = saveId; ; k--) {
    const save = saves[saves.length - 1];
    if (save.phase === Phase.RESEARCH ||
      game.rewinds.some((rewind) => rewind.saveId === k) ||
      save.inputs === undefined ||
      !saveIds.has(k - 1) ||
      replayed + save.inputs.length > MAX_REPLAYED_INPUTS) {
      return saves.reverse();
    }
    replayed += save.inputs.length;
    saves.push(await database.getGameVersion(game.id, k - 1));
  }
}

export type ReplayResult = {outcome: 'replayed' | 'mismatch' | 'no-replay'; reason?: string; game?: Game};

// Thrown from inside a save to end the `process` call that made it.
class ReplayMismatch extends Error {}

/**
 * Loads saves[0] into a sandbox and replays the recorded inputs of saves[1..] with every check.
 * When all checks up to the last save pass, `onTarget` runs inside the sandbox's save of the last save,
 * before play continues. Never changes Timer's shared last stop time.
 */
export function replayToSave(saves: ReadonlyArray<SerializedGame>, onTarget?: (game: Game) => void): ReplayResult {
  if (saves.length < 2) {
    return {outcome: 'no-replay'};
  }
  return Timer.keepingLastStop(() => replay(saves, onTarget));
}

function replay(saves: ReadonlyArray<SerializedGame>, onTarget: ((game: Game) => void) | undefined): ReplayResult {
  const targetId = saves[saves.length - 1].lastSaveId;
  const stored = new Map(saves.map((save) => [save.lastSaveId, save]));
  const inputs: Array<RecordedInput> = saves.slice(1).flatMap((save) => save.inputs ?? []);

  let reached = false;
  // Set when a save does not match, so the reason outlives the error thrown through the game.
  let reason: string | undefined;
  const onSave = (game: Game, saved: SerializedGame) => {
    // Play after the target save is not part of the recording.
    if (reached) {
      return;
    }
    const row = stored.get(saved.lastSaveId);
    if (row === undefined || !sameState(saved, row)) {
      reason = `save ${saved.lastSaveId} differs from the recording`;
      throw new ReplayMismatch(reason);
    }
    if (saved.lastSaveId === targetId) {
      reached = true;
      onTarget?.(game);
    }
  };
  const mismatch = (why: string): ReplayResult => ({outcome: 'mismatch', reason: reason ?? why});

  let sandbox: Game;
  try {
    // Loading saves the game again, and that save is checked against saves[0].
    sandbox = Game.deserialize(structuredClone(saves[0]), {sandbox: true, onSave});
  } catch (e) {
    return mismatch(`save ${saves[0].lastSaveId} does not load: ${e}`);
  }

  for (let i = 0; !reached; i++) {
    const input = inputs[i];
    if (input === undefined) {
      return mismatch(`the inputs run out before save ${targetId}`);
    }
    if (stateHash(sandbox.serialize()) !== input.stateHash) {
      return mismatch(`the state before input ${i} differs from the recording`);
    }
    const player = sandbox.allPlayers.find((p) => p.id === input.playerId);
    const waitingFor = player?.getWaitingFor();
    if (player === undefined || waitingFor === undefined || !samePrompt(waitingFor, input.prompt)) {
      return mismatch(`input ${i} answers a prompt the replay does not show`);
    }
    try {
      player.process(structuredClone(input.response));
    } catch (e) {
      if (reached) {
        // The target save matched. What failed is onTarget or the play after it, not the replay.
        throw e;
      }
      return mismatch(`input ${i} fails: ${e}`);
    }
  }
  return {outcome: 'replayed', game: sandbox};
}

// Compares the prompt as Game.recordInput describes it.
function samePrompt(waitingFor: PlayerInput, prompt: RecordedInput['prompt']): boolean {
  const title = waitingFor.title;
  return waitingFor.type === prompt.type && (typeof title === 'string' ? title : title.message) === prompt.title;
}
