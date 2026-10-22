import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, vi} from 'vitest';
import {defineAsyncComponent} from 'vue';
import {globalConfig} from '@tests/client/components/getLocalVue';
import App from '@/client/components/App.vue';
import {translateMessage} from '@/client/directives/i18n';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {fakeGameModel, fakeGameOptionsModel, fakePlayerViewModel, fakePublicPlayerModel} from '@tests/client/components/testHelpers';

// The real replay screen would load the whole game UI, which isn't what the routing tests are about.
vi.mock('@/client/components/replay/ReplayScreen.vue', () => ({default: {template: '<div class="replay-screen-stub"/>'}}));

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  // Mounts the judge page at `url` for a game in `phase`, served a judge model with one player.
  async function mountJudgePage(phase: string, url = '/judge?id=j1', password?: string, judgeUndo = false) {
    window.history.replaceState({}, '', url);
    const judge = {
      id: 'j1',
      color: 'neutral',
      password,
      signature: 'sig',
      players: [{color: 'red', name: 'Alice'}],
      privates: [],
      game: {phase, gameAge: 1, undoCount: 0, gameOptions: {judgeUndo}},
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, status: 200, json: async () => judge}) as Response));
    const alertStub = vi.fn();
    vi.stubGlobal('alert', alertStub);
    // The real screen imports the whole judge page, which would load after the test ends.
    const wrapper = shallowMount(App, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {
        JudgeHome: {template: '<div class="stub-judge"></div>'},
        ReplayScreen: {name: 'ReplayScreenStub', props: ['participantId', 'liveJudge'], template: '<div class="replay-screen-stub"/>'},
      }},
    });
    await flushPromises();
    return {wrapper, alertStub};
  }

  it('keeps the history of a judge undo game on the judge page, where the judge rewinds it', async () => {
    for (const judgeUndo of [true, false]) {
      const {wrapper} = await mountJudgePage('action', '/judge?id=j1', undefined, judgeUndo);
      const screen = wrapper.findComponent({name: 'ReplayScreenStub'});
      expect(screen.exists(), String(judgeUndo)).equals(judgeUndo);
      expect(wrapper.find('.stub-judge').exists(), String(judgeUndo)).equals(!judgeUndo);
      if (judgeUndo) {
        expect(screen.props('participantId')).eq('j1');
        expect(screen.props('liveJudge')).to.equal((wrapper.vm as any).judge);
      }
    }
  });

  it('keeps a finished judge game on the judge screen', async () => {
    const {wrapper, alertStub} = await mountJudgePage('end');

    expect((wrapper.vm as any).screen).eq('judge-home');
    expect(alertStub.mock.calls).is.empty;
  });

  it('keeps the seat password on the way to a finished game\'s end screen', async () => {
    window.history.replaceState({}, '', '/player?id=p1&password=0123456789ab');
    const player = {
      id: 'p1',
      color: 'red',
      password: '0123456789ab',
      players: [{color: 'red', name: 'Alice'}],
      game: {phase: 'end', gameAge: 1, undoCount: 0, gameOptions: {undoOption: false}},
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, status: 200, json: async () => player}) as Response));
    // The real screen imports the whole end screen, which would load after the test ends.
    shallowMount(App, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GameEnd: {template: '<div class="stub-end"></div>'}}},
    });
    await flushPromises();

    expect(window.location.pathname).eq('/the-end');
    expect(window.location.search).eq('?id=p1&password=0123456789ab');
  });

  it('names players in messages on the judge page', async () => {
    await mountJudgePage('action');

    const message = {message: 'Hello ${0}', data: [{type: LogMessageDataType.PLAYER, value: 'red'}]};
    expect(translateMessage(message as any)).eq('Hello Alice');
  });

  it('replaces a stale judge password in the address bar', async () => {
    await mountJudgePage('action', '/judge?id=j1&password=old', 'new');

    expect(window.location.search).includes('password=new');
    expect(window.location.search).does.not.include('password=old');
  });

  it('replaces a stale player password in the address bar', async () => {
    window.history.replaceState({}, '', '/player?id=p1&password=old');
    const player = {
      id: 'p1',
      color: 'red',
      password: 'new',
      players: [{color: 'red', name: 'Alice'}],
      game: {phase: 'action', gameAge: 1, undoCount: 0, gameOptions: {undoOption: false}},
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, status: 200, json: async () => player}) as Response));
    // The real screen imports the whole player page, which would load after the test ends.
    shallowMount(App, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {PlayerHome: {template: '<div class="stub-player"></div>'}}},
    });
    await flushPromises();

    expect(window.location.search).includes('password=new');
    expect(window.location.search).does.not.include('password=old');
  });

  it('leaves the address bar alone when neither it nor the judge model has a password', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');

    await mountJudgePage('action', '/judge?id=j1&serverId=1');

    // The page rewrites the address bar by passing the model as the history state.
    expect(replaceState.mock.calls.filter((call) => (call[0] as any)?.id === 'j1')).is.empty;
    expect(window.location.search).eq('?id=j1&serverId=1');
  });

  it('tells a judge about an incorrect judge password', async () => {
    const {wrapper, alertStub} = await mountJudgePage('action');
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: false, status: 401}) as Response));

    await (wrapper.vm as any).updateJudge();

    expect(alertStub.mock.calls).deep.eq([['Incorrect judge password. Reopen the judge page from your browser history, or ask the organizer for the judge link with its password.']]);
  });

  describe('player home', () => {
    async function mountPlayerHome(players: number, undoOption: boolean, judgeUndo = false) {
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
        game: fakeGameModel({gameOptions: fakeGameOptionsModel({undoOption, judgeUndo})}),
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

    it('keeps the history of a judged table with Player undo on the game page, beside the judge\'s', async () => {
      const wrapper = await mountPlayerHome(2, true, true);
      expect(wrapper.findComponent({name: 'ReplayScreenStub'}).props('liveView')).to.equal(wrapper.vm.playerView);
    });

    it('shows every other game as it always has', async () => {
      for (const [players, undoOption, judgeUndo] of [[1, false, false], [2, false, false], [2, false, true]] as const) {
        const wrapper = await mountPlayerHome(players, undoOption, judgeUndo);
        expect(wrapper.find('.replay-screen-stub').exists(), `${players} ${undoOption} ${judgeUndo}`).is.false;
        expect(wrapper.find('.player-home-stub').exists(), `${players} ${undoOption} ${judgeUndo}`).is.true;
      }
    });
  });

  describe('frozen game', () => {
    const views = {
      'player-home': 'playerView',
      'spectator-home': 'spectator',
      'judge-home': 'judge',
    } as const;

    it('shows the banner to a player, a spectator and a judge, only while it is frozen', async () => {
      for (const [screen, field] of Object.entries(views)) {
        for (const frozen of [true, false]) {
          const wrapper = shallowMount(App, {
            ...globalConfig,
            global: {
              ...globalConfig.global,
              stubs: {
                PlayerHome: {template: '<div/>'},
                SpectatorHome: {template: '<div/>'},
                JudgeHome: {template: '<div/>'},
                FrozenBanner: {template: '<div class="frozen-banner-stub"/>'},
              },
            },
          });
          const view = {id: 'x', players: [], game: {phase: 'action', gameAge: 1, undoCount: 0, frozen, gameOptions: {undoOption: false}}};
          await wrapper.setData({screen, [field]: view});
          expect(wrapper.find('.frozen-banner-stub').exists(), `${screen} frozen ${frozen}`).eq(frozen);
        }
      }
    });

    it('does not show the banner on a replay URL', async () => {
      const wrapper = shallowMount(App, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {FrozenBanner: {template: '<div class="frozen-banner-stub"/>'}}},
      });
      const view = {id: 'x', players: [], game: {phase: 'action', gameAge: 1, undoCount: 0, frozen: true, gameOptions: {undoOption: false}}};
      await wrapper.setData({screen: 'replay', replayParticipantId: 'p-x', playerView: view});
      expect(wrapper.find('.frozen-banner-stub').exists()).is.false;
    });
  });

  describe('replay route', () => {
    afterEach(() => {
      window.history.replaceState({}, '', '/');
    });

    it('opens the replay screen for a participant id', () => {
      window.history.replaceState({}, '', '/replay?id=s-spectator-id');
      const wrapper = shallowMount(App, globalConfig);
      expect(wrapper.vm.screen).to.equal('replay');
      expect(wrapper.vm.replayParticipantId).to.equal('s-spectator-id');
    });

    it('opens the replay screen for a judge id', () => {
      window.history.replaceState({}, '', '/replay?id=j-judge-id&password=secret');
      const wrapper = shallowMount(App, globalConfig);
      expect(wrapper.vm.screen).to.equal('replay');
      expect(wrapper.vm.replayParticipantId).to.equal('j-judge-id');
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
