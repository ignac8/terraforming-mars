import {LogMessage} from '../../common/logs/LogMessage';
import {LogMessageType} from '../../common/logs/LogMessageType';
import {ParticipantId, PlayerId} from '../../common/Types';
import {Color} from '../../common/Color';
import {IGame} from '../IGame';
import {Phase} from '../../common/Phase';
import {Log} from '../../common/logs/Log';
import {LogMessageData} from '../../common/logs/LogMessageData';
import {LogMessageDataType} from '../../common/logs/LogMessageDataType';
import {activeRewinds, hiddenBy, visibleLog} from '../rewind/RewindRecord';

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

// A line of the game log, and whether a rewind hid it.
type Line = {message: LogMessage, undone: boolean};

export class GameLogs {
  private getLogsForGeneration(lines: Array<Line>, generation: number): Array<Line> {
    let foundStart = generation === 1;
    const newLines = [];
    for (const line of lines) {
      const {message} = line;
      // A line that a rewind hid is from another line of play, so it neither starts nor ends a generation.
      if (!line.undone && message.type === LogMessageType.NEW_GENERATION) {
        const value = Number(message.data[0]?.value);
        if (value === generation) {
          foundStart = true;
        } else if (value === generation + 1) {
          break;
        }
      }
      if (foundStart === true) {
        newLines.push(line);
      }
    }
    return newLines;
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

    return this.selectLogs(game, generation, messagesForPlayer, false).map((line) => line.message);
  }

  /**
   * Every line, private ones included. Each copy loses its `playerId` and carries
   * the owner's color in `owner` instead, so a judge never sees a player id.
   * `showUndone`: the lines a rewind hid stay in, each copy marked `undone: true`.
   */
  public getLogsForJudge(game: IGame, generation: number | undefined, showUndone: boolean = false): Array<LogMessage> {
    const colors = playerColors(game);
    const notEmpty = (message: LogMessage) => message !== undefined && message !== null;
    return this.selectLogs(game, generation, notEmpty, showUndone).map((line) => {
      const copy = toJudgeMessage(line.message, colors);
      if (line.undone) {
        copy.undone = true;
      }
      return copy;
    });
  }

  // Default view keeps the payload small. An explicit generation request should
  // always return the full generation, including the current one.
  private selectLogs(game: IGame, generation: number | undefined, keep: (message: LogMessage) => boolean, showUndone: boolean): Array<Line> {
    const active = activeRewinds(game.rewinds);
    const lines = game.gameLog
      .map((message, idx) => ({message, undone: hiddenBy(idx, active)}))
      // Older saves can have holes in their logs.
      .filter((line) => line.message !== undefined && line.message !== null)
      .filter((line) => showUndone || !line.undone);
    if (generation === undefined) {
      return lines.filter((line) => keep(line.message)).slice(-50);
    }
    return this.getLogsForGeneration(lines, generation).filter((line) => keep(line.message));
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
