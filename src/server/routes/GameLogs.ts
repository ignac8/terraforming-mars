import {LogMessage} from '../../common/logs/LogMessage';
import {LogMessageType} from '../../common/logs/LogMessageType';
import {ParticipantId, PlayerId} from '../../common/Types';
import {Color} from '../../common/Color';
import {IGame} from '../IGame';
import {Phase} from '../../common/Phase';
import {Log} from '../../common/logs/Log';
import {LogMessageData} from '../../common/logs/LogMessageData';
import {LogMessageDataType} from '../../common/logs/LogMessageDataType';
import {visibleLog} from '../rewind/RewindRecord';

/**
 * A private line as everyone sees it once the game has ended: it loses its `playerId` and carries the color of the
 * player it was for in `owner` instead, so a player id never reaches a viewer. Returns a copy.
 */
export function withOwner(message: LogMessage, colors: ReadonlyMap<PlayerId, Color>): LogMessage {
  const copy = {...message};
  if (message.playerId !== undefined) {
    delete copy.playerId;
    copy.owner = colors.get(message.playerId);
  }
  return copy;
}

/** MarsBot's player is in it too, since a line can be reserved for it. */
export function playerColors(game: IGame): ReadonlyMap<PlayerId, Color> {
  return new Map(game.playersPlusMarsBot.map((player) => [player.id, player.color]));
}

export class GameLogs {
  private getLogsForGeneration(messages: Array<LogMessage>, generation: number): Array<LogMessage> {
    let foundStart = generation === 1;
    const newMessages = [];
    for (const message of messages) {
      // Older saves can have holes in their logs.
      if (message?.type === LogMessageType.NEW_GENERATION) {
        const value = Number(message.data[0]?.value);
        if (value === generation) {
          foundStart = true;
        } else if (value === generation + 1) {
          break;
        }
      }
      if (foundStart === true) {
        newMessages.push(message);
      }
    }
    return newMessages;
  }

  /**
   * The lines `playerId` may see: its own private lines and the public ones. Once the game has ended everyone sees
   * every line, each private one in the form of `withOwner`.
   */
  public getLogsForGameView(playerId: ParticipantId, game: IGame, generation: number | undefined): Array<LogMessage> {
    const colors = game.phase === Phase.END ? playerColors(game) : undefined;
    const messagesForPlayer = (message: LogMessage) => {
      try {
        if (message === undefined || message === null) {
          return false;
        }
        return colors !== undefined || message.playerId === undefined || message.playerId === playerId;
      } catch (e) {
        console.error('Error checking message for player', e);
        return false;
      }
    };

    // The lines a rewind hid are from another line of play, so they neither show nor start or end a generation.
    const log = visibleLog(game.gameLog, game.rewinds);
    // Default view keeps the payload small. An explicit generation request should
    // always return the full generation, including the current one.
    const lines = generation === undefined ?
      log.filter(messagesForPlayer).slice(-50) :
      this.getLogsForGeneration(log, generation).filter(messagesForPlayer);
    return colors === undefined ? lines : lines.map((line) => withOwner(line, colors));
  }

  public getLogsForGameEnd(game: IGame): Array<string> {
    if (game.phase !== Phase.END) {
      throw new Error('Game is not over');
    }

    return visibleLog(game.gameLog, game.rewinds).filter((message) => message !== undefined && message !== null).map((message) => Log.applyData(message, (datum: LogMessageData) => {
      if (datum.type === undefined || datum.value === undefined) {
        return '';
      }

      switch (datum.type) {
      case LogMessageDataType.PLAYER:
        for (const player of game.players) {
          if (datum.value === player.color) {
            return player.name;
          }
        }
        // Fall-back, show the player color.
        return datum.value;

      case LogMessageDataType.RESOURCE:
      case LogMessageDataType.PRODUCTION:
      case LogMessageDataType.CARD_RESOURCE:
        return Log.shortcode(datum) ?? datum.value.toString();

      case LogMessageDataType.CARD:
      case LogMessageDataType.GLOBAL_EVENT:
      case LogMessageDataType.TILE_TYPE:
      case LogMessageDataType.COLONY:
      default:
        return datum.value.toString();
      }
    }));
  }
}
