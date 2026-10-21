import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, vi} from 'vitest';
import {defineAsyncComponent} from 'vue';
import {globalConfig} from '@tests/client/components/getLocalVue';
import App from '@/client/components/App.vue';
import {translateMessage} from '@/client/directives/i18n';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';

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
  async function mountJudgePage(phase: string, url = '/judge?id=j1', password?: string) {
    window.history.replaceState({}, '', url);
    const judge = {
      id: 'j1',
      color: 'neutral',
      password,
      signature: 'sig',
      players: [{color: 'red', name: 'Alice'}],
      privates: [],
      game: {phase, gameAge: 1, undoCount: 0},
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, status: 200, json: async () => judge}) as Response));
    const alertStub = vi.fn();
    vi.stubGlobal('alert', alertStub);
    // The real screen imports the whole judge page, which would load after the test ends.
    const wrapper = shallowMount(App, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {JudgeHome: {template: '<div class="stub-judge"></div>'}}},
    });
    await flushPromises();
    return {wrapper, alertStub};
  }

  it('keeps a finished judge game on the judge screen', async () => {
    const {wrapper, alertStub} = await mountJudgePage('end');

    expect((wrapper.vm as any).screen).eq('judge-home');
    expect(alertStub.mock.calls).is.empty;
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
      game: {phase: 'action', gameAge: 1, undoCount: 0},
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
});
