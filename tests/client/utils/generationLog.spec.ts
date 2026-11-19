import {expect} from 'chai';
import {latestLoggedGeneration, logOfGeneration} from '@/client/utils/generationLog';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {LogMessageType} from '@/common/logs/LogMessageType';

function line(text: string): LogMessage {
  return new LogMessage(LogMessageType.DEFAULT, text, []);
}

function generation(n: number, undone: boolean = false): LogMessage {
  const message = new LogMessage(LogMessageType.NEW_GENERATION, 'Generation ${0}', [{type: LogMessageDataType.RAW_STRING, value: String(n)}]);
  if (undone) {
    message.undone = true;
  }
  return message;
}

const texts = (messages: ReadonlyArray<LogMessage>) => messages.map((m) => m.message);

describe('generationLog', () => {
  const log = [line('setup'), generation(1), line('a'), generation(2), line('b'), line('c'), generation(3), line('d')];

  describe('logOfGeneration', () => {
    it('runs from the line that announces a generation to the line that announces the next', () => {
      expect(texts(logOfGeneration(log, 2))).deep.eq(['Generation ${0}', 'b', 'c']);
      expect(texts(logOfGeneration(log, 3))).deep.eq(['Generation ${0}', 'd']);
    });

    it('starts the first generation at the start of the log, before any line announces it', () => {
      expect(texts(logOfGeneration(log, 1))).deep.eq(['setup', 'Generation ${0}', 'a']);
      expect(texts(logOfGeneration([line('x')], 1))).deep.eq(['x']);
    });

    it('is empty for a generation the log has not got to', () => {
      expect(logOfGeneration(log, 4)).deep.eq([]);
      expect(logOfGeneration([], 2)).deep.eq([]);
    });

    it('does not take a line that a rewind hid for the start or the end of a generation', () => {
      const hidden = [generation(1), line('a'), generation(2), line('b'), generation(3, true), line('c')];
      expect(texts(logOfGeneration(hidden, 2))).deep.eq(['Generation ${0}', 'b', 'Generation ${0}', 'c']);
      expect(logOfGeneration(hidden, 3)).deep.eq([]);
    });
  });

  describe('latestLoggedGeneration', () => {
    it('is the newest generation a line announces', () => {
      expect(latestLoggedGeneration(log)).eq(3);
    });

    it('is the first before any line announces another', () => {
      expect(latestLoggedGeneration([])).eq(1);
      expect(latestLoggedGeneration([line('a')])).eq(1);
    });

    it('leaves out a line that a rewind hid', () => {
      expect(latestLoggedGeneration([generation(1), generation(2), generation(3, true)])).eq(2);
    });
  });
});
