import {LogMessage} from '../../common/logs/LogMessage';
import {LogMessageType} from '../../common/logs/LogMessageType';
import {ParticipantId, PlayerId} from '../../common/Types';
import {Color} from '../../common/Color';
import {IGame} from '../IGame';
import {Phase} from '../../common/Phase';
import {Log} from '../../common/logs/Log';
import {LogMessageData} from '../../common/logs/LogMessageData';
import {LogMessageDataType} from '../../common/logs/LogMessageDataType';

/**
 * What a judge sees of a log line: a private line loses its `playerId` and carries the owner's
 * color in `owner` instead, so a judge never sees a player id. Returns a copy.
 */
export function toJudgeMessage(message: LogMessage, colors: ReadonlyMap<PlayerId, Color>): LogMessage {
  const copy = {...message};
  if (message.playerId !== undefined) {
    delete copy.playerId;
    copy.owner = colors.get(message.playerId);
  }
  return copy;
}

export function playerColors(game: IGame): ReadonlyMap<PlayerId, Color> {
  return new Map(game.players.map((player) => [player.id, player.color]));
}

export class GameLogs {
  private getLogsForGeneration(messages: Array<LogMessage>, generation: number): Array<LogMessage> {
    let foundStart = generation === 1;
    const newMessages = [];
    for (const message of messages) {
      if (message.type === LogMessageType.NEW_GENERATION) {
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

  public getLogsForGameView(playerId: ParticipantId, game: IGame, generation: number | undefined): Array<LogMessage> {
    const messagesForPlayer = (message: LogMessage) => {
      try {
        if (message === undefined || message === null) {
          return false;
        }
        return message.playerId === undefined || message.playerId === playerId;
      } catch (e) {
        console.error('Error checking message for player', e);
        return false;
      }
    };

    return this.selectLogs(game, generation, messagesForPlayer);
  }

  /**
   * Every line, private ones included. Each copy loses its `playerId` and carries
   * the owner's color in `owner` instead, so a judge never sees a player id.
   */
  public getLogsForJudge(game: IGame, generation: number | undefined): Array<LogMessage> {
    const colors = playerColors(game);
    const notEmpty = (message: LogMessage) => message !== undefined && message !== null;
    return this.selectLogs(game, generation, notEmpty).map((message) => toJudgeMessage(message, colors));
  }

  // Default view keeps the payload small. An explicit generation request should
  // always return the full generation, including the current one.
  private selectLogs(game: IGame, generation: number | undefined, keep: (message: LogMessage) => boolean): Array<LogMessage> {
    if (generation === undefined) {
      return game.gameLog.filter(keep).slice(-50);
    }
    return this.getLogsForGeneration(game.gameLog, generation).filter(keep);
  }

  public getLogsForGameEnd(game: IGame): Array<string> {
    if (game.phase !== Phase.END) {
      throw new Error('Game is not over');
    }

    return game.gameLog.map((message) => Log.applyData(message, (datum: LogMessageData) => {
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
