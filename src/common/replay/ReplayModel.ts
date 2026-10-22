import {Color} from '../Color';
import {LogMessage} from '../logs/LogMessage';
import {PlayerViewModel, PrivatePlayerFields} from '../models/PlayerModel';
import {SpectatorModel} from '../models/SpectatorModel';

export type ReplayMove = {saveId: number; messages: Array<LogMessage>};

export type ReplayViewAs = 'all' | Color;

export type RewindCards = 'same' | 'shuffle';

/** A rewind's clocks: as they were at the restored moment, or every player's live total. */
export type RewindClocks = 'back' | 'keep';

/** What a player's clock reads now and at the selected move. `now` is empty when there is no live game to read it from. */
export type RewindClockRow = {color: Color; name: string; now: string; then: string};

export type ReplayMovesModel =
  | {status: 'available'; moves: Array<ReplayMove>; finished: boolean; canRewind: boolean; canVoteRewind: boolean; defaultViewAs: ReplayViewAs}
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
