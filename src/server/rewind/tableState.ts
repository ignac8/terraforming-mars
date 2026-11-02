import {PlayerId} from '../../common/Types';
import {SerializedTimer} from '../../common/SerializedTimer';
import {RewindCards} from '../../common/replay/ReplayModel';
import {SerializedGame} from '../SerializedGame';

/** An open or rewinding rewind vote as it is stored. Ended votes are never stored. */
export type SerializedRewindVote = {
  id: number;
  requester: PlayerId;
  saveId: number;
  /** 1-based place of the move in the move list when the vote was opened. */
  moveNumber: number;
  generation: number;
  cards: RewindCards;
  /** Starts with the requester. */
  yes: Array<PlayerId>;
  status: 'open' | 'rewinding';
  /** Wall-clock deadline, epoch ms. */
  expiresAt: number;
};

/** Players whose request was declined or expired in `generation`; they may not ask again until it changes. */
export type RewindRequestLimits = {generation: number; players: Array<PlayerId>};

/** The fields of a save that no input produces and stateHash leaves out. They change between saves, by a freeze or a vote. */
export type TableStatePatch = {
  frozen: boolean;
  rewindVote: SerializedRewindVote | undefined;
  rewindRequestLimits: RewindRequestLimits | undefined;
  undoCount: number;
  timers: Array<{player: PlayerId; timer: SerializedTimer}>;
};

type TableStateFields = Pick<SerializedGame, 'frozen' | 'rewindVote' | 'rewindRequestLimits' | 'undoCount' | 'players'>;

/** A copy of the save `d` with the fields of `patch` set. `false` or `undefined` leaves the key out. */
export function withTableState<T extends TableStateFields>(d: T, patch: TableStatePatch): T {
  const {frozen: _frozen, rewindVote: _rewindVote, rewindRequestLimits: _rewindRequestLimits, ...rest} = d;
  const result = {
    ...rest,
    undoCount: patch.undoCount,
    players: d.players.map((player) => {
      const timer = patch.timers.find((t) => t.player === player.id)?.timer;
      return timer === undefined ? player : {...player, timer};
    }),
  } as unknown as T;
  if (patch.frozen) {
    result.frozen = true;
  }
  if (patch.rewindVote !== undefined) {
    result.rewindVote = patch.rewindVote;
  }
  if (patch.rewindRequestLimits !== undefined) {
    result.rewindRequestLimits = patch.rewindRequestLimits;
  }
  return result;
}
