import {Color} from '../Color';
import {LogMessage} from '../logs/LogMessage';
import {PlayerViewModel, PrivatePlayerFields} from '../models/PlayerModel';
import {SpectatorModel} from '../models/SpectatorModel';

export type ReplayMove = {saveId: number; messages: Array<LogMessage>};

export type ReplayMovesModel =
  | {status: 'available'; moves: Array<ReplayMove>}
  | {status: 'not-finished'}
  | {status: 'expired'};

export type ReplayViewAs = 'all' | Color;

export type ReplayPrivates = PrivatePlayerFields & {color: Color};

export type ReplayViewModel = {
  saveId: number;
  viewAs: ReplayViewAs;
  view: PlayerViewModel | SpectatorModel;
  /** Every player's private cards when `viewAs` is `'all'`, otherwise empty. */
  privates: Array<ReplayPrivates>;
};
