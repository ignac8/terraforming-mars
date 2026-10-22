import {LogMessageType} from './LogMessageType';
import {LogMessageData} from './LogMessageData';
import {Message} from './Message';
import {PlayerId} from '../Types';
import {Color} from '../Color';

export class LogMessage implements Message {
  public playerId?: PlayerId;
  // Set by the judge log route in place of playerId, so judges see who a private line belongs to.
  public owner?: Color;
  // Set by the judge log route on a line a rewind hid, which the judge sees only when asked.
  public undone?: boolean;
  public timestamp = Date.now();
  public type?: LogMessageType;
  constructor(
    type: LogMessageType,
    public message: string,
    public data: Array<LogMessageData>,
    // When set, this message is private for the specified player.
    // Always filter messages so they're not sent to the wrong player.
    playerId?: PlayerId) {
    // setting in body to avoid setting property when
    // argument is undefined for less memory usage
    if (playerId !== undefined) {
      this.playerId = playerId;
    }
    // only store property if not default
    // for less memory usage. majority
    // of messages are default
    if (type !== LogMessageType.DEFAULT) {
      this.type = type;
    }
  }
}

