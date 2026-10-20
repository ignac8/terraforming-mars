import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, vi} from 'vitest';
import {defineAsyncComponent} from 'vue';
import {globalConfig} from '@tests/client/components/getLocalVue';
import App from '@/client/components/App.vue';

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(App, globalConfig);
    expect(wrapper.exists()).to.be.true;
  });

  // Mounts the start screen with an import() that rejects with `err`.
  async function mountWithFailingStartScreen(err: Error) {
    // jsdom reports the reload as not implemented.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    shallowMount(App, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        config: {...globalConfig.global.config, errorHandler: () => {}},
        stubs: {StartScreen: defineAsyncComponent(() => Promise.reject(err))},
      },
    });
    await flushPromises();
  }

  it('reloads when a screen fails to load', async () => {
    await mountWithFailingStartScreen(Object.assign(new Error('Loading chunk 996 failed.'), {name: 'ChunkLoadError'}));
    // Set just before the reload, for the loop guard.
    expect(window.sessionStorage.getItem('chunkReloadAt')).is.not.null;
  });

  it('leaves other errors alone', async () => {
    await mountWithFailingStartScreen(new Error('boom'));
    expect(window.sessionStorage.getItem('chunkReloadAt')).is.null;
  });
});
