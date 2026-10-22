import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import FrozenBanner from '@/client/components/replay/FrozenBanner.vue';

describe('FrozenBanner', () => {
  it('says why nobody can act', () => {
    const wrapper = mount(FrozenBanner, globalConfig);

    expect(wrapper.text()).includes('The judge froze the game.');
  });
});
