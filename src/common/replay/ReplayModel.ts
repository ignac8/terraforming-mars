import {Color} from '../Color';
import {LogMessage} from '../logs/LogMessage';

export type ReplayMove = {saveId: number; generation: number; messages: Array<LogMessage>};

export type ReplayMovesModel =
  | {status: 'available'; moves: Array<ReplayMove>}
  | {status: 'not-finished'}
  | {status: 'expired'};

export type ReplayViewAs = 'all' | Color;
