import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach} from 'vitest';
import {globalConfig} from './getLocalVue';
import ReportProblemsBanner from '@/client/components/ReportProblemsBanner.vue';
import {setTranslationsForTest} from '@/client/directives/i18n';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import plStartScreen from '@/locales/pl/start_screen.json';

describe('ReportProblemsBanner', () => {
  afterEach(() => {
    PreferencesManager.INSTANCE.set('lang', 'en');
    setTranslationsForTest(undefined);
  });

  it('links to the issues page', () => {
    const wrapper = mount(ReportProblemsBanner, globalConfig);

    expect(wrapper.text()).eq('In case of any problems, report them here: GitHub issues');
    expect(wrapper.find('a').attributes('href')).eq('https://github.com/ignac8/terraforming-mars/issues');
  });

  it('is translated', () => {
    PreferencesManager.INSTANCE.set('lang', 'pl');
    setTranslationsForTest(plStartScreen);
    const wrapper = mount(ReportProblemsBanner, globalConfig);

    expect(wrapper.find('span').text()).eq('W razie jakichkolwiek problemów zgłoś je tutaj:');
    expect(wrapper.find('a').text()).eq('zgłoszenia na GitHubie');
  });
});
