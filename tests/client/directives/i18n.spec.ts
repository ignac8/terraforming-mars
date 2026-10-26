import {expect} from 'chai';
import {vi} from 'vitest';
import {setTranslationContext, setTranslationsForTest, translateMessage, translateText} from '@/client/directives/i18n';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Message} from '@/common/logs/Message';

describe('i18n', () => {
  function reset() {
    localStorage.removeItem('lang');
    PreferencesManager.resetForTest();
    setTranslationsForTest(undefined);
  }

  // Client tests share module state across files (isolate: false), so don't
  // assume earlier files left the language at its default.
  beforeEach(reset);
  afterEach(reset);

  it('returns English text unchanged when lang is en', () => {
    setTranslationsForTest({'Goal': 'Ziel'});
    expect(translateText('Goal')).eq('Goal');
  });

  it('translates text', () => {
    PreferencesManager.INSTANCE.set('lang', 'de');
    setTranslationsForTest({'Goal': 'Ziel'});
    expect(translateText('Goal')).eq('Ziel');
  });

  it('does not look up strings made only of icons and numbers', () => {
    PreferencesManager.INSTANCE.set('lang', 'de');
    setTranslationsForTest({'Goal': 'Ziel'});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(translateText('-3:r:mc: -1:r:steel:')).eq('-3:r:mc: -1:r:steel:');
    } finally {
      log.mockRestore();
    }
  });

  it('translates text that contains icons', () => {
    PreferencesManager.INSTANCE.set('lang', 'de');
    setTranslationsForTest({'Gain 3:r:mc:': 'Erhalte 3:r:mc:'});
    expect(translateText('Gain 3:r:mc:')).eq('Erhalte 3:r:mc:');
  });
});

describe('translateMessage', () => {
  const removePlantsFrom = (): Message => ({
    message: 'Remove plants from ${0}',
    data: [{type: LogMessageDataType.PLAYER, value: 'bronze'}],
  });

  it('names MarsBot instead of showing its color', () => {
    setTranslationContext({
      players: [{color: 'blue', name: 'Alice'}],
      game: {marsBot: {name: 'MarsBot', color: 'bronze'}},
    } as unknown as PlayerViewModel);

    expect(translateMessage(removePlantsFrom())).eq('Remove plants from MarsBot');
  });

  it('names human players', () => {
    setTranslationContext({
      players: [{color: 'blue', name: 'Alice'}],
      game: {marsBot: undefined},
    } as unknown as PlayerViewModel);

    expect(translateMessage({
      message: 'Remove plants from ${0}',
      data: [{type: LogMessageDataType.PLAYER, value: 'blue'}],
    })).eq('Remove plants from Alice');
  });
});
