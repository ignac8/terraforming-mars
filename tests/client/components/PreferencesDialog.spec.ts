import {mount, VueWrapper, DOMWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import PreferencesDialog from '@/client/components/PreferencesDialog.vue';
import {Preference, PreferencesManager} from '@/client/utils/PreferencesManager';
import {setTranslationsForTest} from '@/client/directives/i18n';
import {globalConfig} from './getLocalVue';

describe('PreferencesDialog', () => {
  const preferencesManager = PreferencesManager.INSTANCE;

  function getDataTest(wrapper: VueWrapper<any>, field: Preference): DOMWrapper<Element> {
    return wrapper.find(`[data-test=${field}]`);
  }

  function getCheckbox(wrapper: VueWrapper<any>, field: Preference): HTMLInputElement {
    return getDataTest(wrapper, field).element as HTMLInputElement;
  }

  it('defaults properly set', () => {
    preferencesManager.set('learner_mode', true);
    preferencesManager.set('hide_awards_and_milestones', false);

    const wrapper = mount(PreferencesDialog, {
      ...globalConfig,
      props: {preferencesManager},
    });

    expect(preferencesManager.values().hide_awards_and_milestones).is.false;
    expect(getCheckbox(wrapper, 'hide_awards_and_milestones').checked).is.false;

    expect(getCheckbox(wrapper, 'learner_mode').checked).is.true;
    expect(preferencesManager.values().learner_mode).is.true;
  });

  it('toggling sets the underlying preferences', async () => {
    const wrapper = mount(PreferencesDialog, {
      ...globalConfig,
      props: {preferencesManager},
    });

    expect(preferencesManager.values().hide_awards_and_milestones).is.false;

    const cbWrapper = getDataTest(wrapper, 'hide_awards_and_milestones');
    const cb = getCheckbox(wrapper, 'hide_awards_and_milestones');
    cb.checked = true;
    cbWrapper.trigger('change');
    await wrapper.vm.$nextTick();

    expect(preferencesManager.values().hide_awards_and_milestones).is.true;
  });

  describe('My color', () => {
    function reset() {
      localStorage.removeItem('lang');
      PreferencesManager.resetForTest();
      setTranslationsForTest(undefined);
    }

    // Client tests share module state across files (isolate: false), so don't
    // assume earlier files left the language at its default.
    beforeEach(reset);
    afterEach(reset);

    function clearOption(lang: string, translations: {[key: string]: string}): string {
      PreferencesManager.INSTANCE.set('lang', lang);
      setTranslationsForTest(translations);
      const wrapper = mount(PreferencesDialog, {
        ...globalConfig,
        props: {preferencesManager: PreferencesManager.INSTANCE},
      });
      return wrapper.find('[data-test=my_color] option[value=clear]').text();
    }

    it('calls the clear color Clear in English', () => {
      expect(clearOption('en', {})).eq('Clear');
    });

    it('translates the clear color from Transparent, not from the Clear button', () => {
      expect(clearOption('pl', {Transparent: 'Przezroczysty', Clear: 'Wyczyść'})).eq('Przezroczysty');
    });
  });
});
