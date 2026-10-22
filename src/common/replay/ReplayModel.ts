import {Color} from '../Color';
import {LogMessage} from '../logs/LogMessage';
import {PlayerViewModel, PrivatePlayerFields} from '../models/PlayerModel';
import {SpectatorModel} from '../models/SpectatorModel';

/**
 * `undone`: a rewind abandoned this move. Only the judge's list shows such moves, and only when asked.
 * `mover`: the colour of the player who made the move, when the saves tell. A colour and not an id,
 * because a running game's public models carry no player ids.
 */
export type ReplayMove = {saveId: number; messages: Array<LogMessage>; undone?: boolean; mover?: Color};

export type ReplayViewAs = 'all' | Color;

export type RewindCards = 'same' | 'shuffle';

/**
 * A rewind's clocks: every player's as they were at the restored moment, or, with 'keep', the live total of the
 * player whose move is undone, while everyone else's go back.
 */
export type RewindClocks = 'back' | 'keep';

/** What a player's clock reads now and at the selected move. `now` is empty when there is no live game to read it from. */
export type RewindClockRow = {color: Color; name: string; now: string; then: string};

export type ReplayMovesModel =
  | {
    status: 'available'; moves: Array<ReplayMove>; finished: boolean; canRewind: boolean; canVoteRewind: boolean;
    defaultViewAs: ReplayViewAs;
    /** The colour of the player who asked. Replay views carry no player ids, so this is how a player's page knows its own seat. */
    viewerColor?: Color;
  }
  | {status: 'not-finished'}
  | {status: 'expired'};

export type ReplayPrivates = PrivatePlayerFields & {color: Color};

export type ReplayViewModel = {
  saveId: number;
  viewAs: ReplayViewAs;
  view: PlayerViewModel | SpectatorModel;
  /** Every player's private cards when `viewAs` is `'all'`, otherwise empty. */
  privates: Array<ReplayPrivates>;
};
