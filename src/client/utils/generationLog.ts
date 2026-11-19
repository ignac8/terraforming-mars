import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';

/**
 * The generation a line announces, if it does. A line that a rewind hid is from another line of play,
 * so it announces nothing.
 */
function announcedGeneration(message: LogMessage): number | undefined {
  if (message.undone === true || message.type !== LogMessageType.NEW_GENERATION) {
    return undefined;
  }
  return Number(message.data[0]?.value);
}

/** The lines of one generation, from the line that announces it to the line that announces the next. Like the server's log route. */
export function logOfGeneration(messages: ReadonlyArray<LogMessage>, generation: number): Array<LogMessage> {
  let started = generation === 1;
  const lines: Array<LogMessage> = [];
  for (const message of messages) {
    const announced = announcedGeneration(message);
    if (announced === generation) {
      started = true;
    } else if (announced === generation + 1) {
      break;
    }
    if (started) {
      lines.push(message);
    }
  }
  return lines;
}

/** The newest generation the lines announce, which is the first until one says otherwise. */
export function latestLoggedGeneration(messages: ReadonlyArray<LogMessage>): number {
  return messages.reduce((latest, message) => Math.max(latest, announcedGeneration(message) ?? 0), 1);
}
