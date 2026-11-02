import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, vi} from 'vitest';
import {defineAsyncComponent} from 'vue';
import {globalConfig} from '@tests/client/components/getLocalVue';
import App from '@/client/components/App.vue';
import {fakeGameModel, fakeGameOptionsModel, fakePlayerViewModel, fakePublicPlayerModel} from '@tests/client/components/testHelpers';

// The real replay screen would load the whole game UI, which isn't what the routing tests are about.
vi.mock('@/client/components/replay/ReplayScreen.vue', () => ({default: {template: '<div class="replay-screen-stub"/>'}}));

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
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

  describe('player home', () => {
    async function mountPlayerHome(players: number, undoOption: boolean) {
      const wrapper = shallowMount(App, {
        ...globalConfig,
        global: {
          ...globalConfig.global,
          stubs: {
            ReplayScreen: {name: 'ReplayScreenStub', props: ['liveView'], template: '<div class="replay-screen-stub"/>'},
            PlayerHome: {template: '<div class="player-home-stub"/>'},
          },
        },
      });
      const playerView = fakePlayerViewModel({
        players: Array.from({length: players}, () => fakePublicPlayerModel()),
        game: fakeGameModel({gameOptions: fakeGameOptionsModel({undoOption})}),
      });
      await wrapper.setData({screen: 'player-home', playerView});
      return wrapper;
    }

    it('keeps the history of a solo game with Player undo on the game page', async () => {
      const wrapper = await mountPlayerHome(1, true);
      expect(wrapper.findComponent({name: 'ReplayScreenStub'}).props('liveView')).to.equal(wrapper.vm.playerView);
      expect(wrapper.find('.player-home-stub').exists()).is.false;
    });

    it('keeps the history of a multiplayer game with Player undo on the game page, where its players vote on a rewind', async () => {
      const wrapper = await mountPlayerHome(2, true);
      expect(wrapper.findComponent({name: 'ReplayScreenStub'}).props('liveView')).to.equal(wrapper.vm.playerView);
      expect(wrapper.find('.player-home-stub').exists()).is.false;
    });

    it('shows every other game as it always has', async () => {
      for (const [players, undoOption] of [[1, false], [2, false]] as const) {
        const wrapper = await mountPlayerHome(players, undoOption);
        expect(wrapper.find('.replay-screen-stub').exists(), `${players} ${undoOption}`).is.false;
        expect(wrapper.find('.player-home-stub').exists(), `${players} ${undoOption}`).is.true;
      }
    });
  });

  describe('replay route', () => {
    it('opens the replay screen for a player id', () => {
      window.history.replaceState({}, '', '/replay?id=p-player-id');
      const wrapper = shallowMount(App, globalConfig);
      expect(wrapper.vm.screen).to.equal('replay');
      expect(wrapper.vm.replayParticipantId).to.equal('p-player-id');
    });

    it('opens the replay screen for a spectator id', () => {
      window.history.replaceState({}, '', '/replay?id=s-spectator-id');
      const wrapper = shallowMount(App, globalConfig);
      expect(wrapper.vm.screen).to.equal('replay');
      expect(wrapper.vm.replayParticipantId).to.equal('s-spectator-id');
    });

    it('alerts on a bad id', () => {
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      window.history.replaceState({}, '', '/replay?id=nonsense');
      const wrapper = shallowMount(App, globalConfig);
      expect(alert.mock.calls).to.deep.equal([['Bad id URL parameter.']]);
      expect(wrapper.vm.screen).to.equal('empty');
    });
  });
});
