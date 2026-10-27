import {Color} from '../Color';
import {LogMessage} from '../logs/LogMessage';
import {PendingChoiceModel} from '../models/PendingChoiceModel';
import {PlayerViewModel, PrivatePlayerFields} from '../models/PlayerModel';
import {SpectatorModel} from '../models/SpectatorModel';

/**
 * `undone`: a rewind abandoned this move. Only the solo player's list shows such moves, and only when asked.
 * `movers`: the colours of the players who answered to make the move, in the order of their first answer, when the
 * saves tell. A step that several players answered together, like research, is every one of theirs. Colours and not
 * ids, because a running game's public models carry no player ids.
 */
export type ReplayMove = {saveId: number; messages: Array<LogMessage>; undone?: boolean; movers?: Array<Color>};

export type ReplayViewAs = 'all' | Color;

export type RewindCards = 'same' | 'shuffle';

/**
 * A rewind's clocks: every player's as they were at the restored moment, or, with 'keep', the live total of every
 * player who answered the move that is undone, while everyone else's go back.
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

/** `pendingChoice`: what the player was choosing among at the move, whose prompt is never sent. */
export type ReplayPrivates = PrivatePlayerFields & {color: Color; pendingChoice?: PendingChoiceModel};

export type ReplayViewModel = {
  saveId: number;
  viewAs: ReplayViewAs;
  view: PlayerViewModel | SpectatorModel;
  /** Every player's private cards when `viewAs` is `'all'`, otherwise empty. */
  privates: Array<ReplayPrivates>;
  /** What the player viewed as was choosing among at the move. Only when `viewAs` is a player. */
  pendingChoice?: PendingChoiceModel;
};
