import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, beforeEach, vi} from 'vitest';
import {globalConfig} from '../getLocalVue';
import BannerStack from '@/client/components/replay/BannerStack.vue';

describe('BannerStack', () => {
  let resize: (entries: Array<unknown>) => void;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: typeof resize) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a spacer in the flow as tall as the banners', async () => {
    const wrapper = mount(BannerStack, {...globalConfig, props: {frozen: false}});
    const spacer = () => wrapper.find('.rewind-banners-spacer').attributes('style');

    expect(spacer()).includes('height: 0px');

    for (const height of [96.4, 0]) {
      resize([{contentRect: {height}}]);
      await wrapper.vm.$nextTick();
      expect(spacer()).includes(`height: ${Math.ceil(height)}px`);
    }
  });
});
