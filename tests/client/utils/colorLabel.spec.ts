import {expect} from 'chai';
import {translateColorLabel} from '@/client/utils/colorLabel';
import {setTranslationsForTest} from '@/client/directives/i18n';
import {PreferencesManager} from '@/client/utils/PreferencesManager';

describe('colorLabel', () => {
  function reset() {
    localStorage.removeItem('lang');
    PreferencesManager.resetForTest();
    setTranslationsForTest(undefined);
  }

  // Client tests share module state across files (isolate: false), so don't
  // assume earlier files left the language at its default.
  beforeEach(reset);
  afterEach(reset);

  function useLanguage(lang: string, translations: {[key: string]: string}) {
    PreferencesManager.INSTANCE.set('lang', lang);
    setTranslationsForTest(translations);
  }

  it('calls clear Clear in English', () => {
    useLanguage('en', {});

    expect(translateColorLabel('clear')).eq('Clear');
    expect(translateColorLabel('orange')).eq('Orange');
  });

  it('translates clear from Transparent, not from the Clear button', () => {
    useLanguage('pl', {Transparent: 'Przezroczysty', Clear: 'Wyczyść', Orange: 'Pomarańczowy'});

    expect(translateColorLabel('clear')).eq('Przezroczysty');
    expect(translateColorLabel('orange')).eq('Pomarańczowy');
  });

  it('falls back to the English label in a language without the color', () => {
    useLanguage('de', {});

    expect(translateColorLabel('clear')).eq('Clear');
  });
});
