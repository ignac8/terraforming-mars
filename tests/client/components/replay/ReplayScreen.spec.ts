import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, beforeEach, vi} from 'vitest';
import {globalConfig} from '../getLocalVue';
import ReplayScreen from '@/client/components/replay/ReplayScreen.vue';
import ReplayPanel from '@/client/components/replay/ReplayPanel.vue';
import ReplayHands from '@/client/components/replay/ReplayHands.vue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import SpectatorHome from '@/client/components/SpectatorHome.vue';
import {fakePlayerViewModel, fakeSpectatorModel} from '../testHelpers';
import {ReplayMovesModel, ReplayViewModel} from '@/common/replay/ReplayModel';
import {SpectatorId} from '@/common/Types';
import {translateMessage} from '@/client/directives/i18n';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {fakePublicPlayerModel} from '../testHelpers';

const id = 's-spectator-id' as SpectatorId;

describe('ReplayScreen', () => {
  let originalFetch: any;
  let calls: Array<string>;
  let movesAnswer: ReplayMovesModel;
  /** Holds a view answer back until the returned promise resolves. */
  let holdView: ((saveId: number) => Promise<void> | undefined) | undefined;
  /** Names the players of the view it is asked about. */
  let playerNames: Record<string, string>;

  function respond(body: unknown) {
    return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('')});
  }

  beforeEach(() => {
    originalFetch = (global as any).fetch;
    calls = [];
    holdView = undefined;
    playerNames = {};
    movesAnswer = {status: 'available', moves: [
      {saveId: 10, messages: []},
      {saveId: 11, messages: []},
    ]};
    (global as any).fetch = async (url: string) => {
      calls.push(url);
      if (url.startsWith('api/replay/moves')) {
        return respond(movesAnswer);
      }
      const params = new URL(url, 'http://localhost/').searchParams;
      const viewAs = params.get('as') as ReplayViewModel['viewAs'];
      const saveId = Number(params.get('save'));
      const view = viewAs === 'all' ? fakeSpectatorModel() : fakePlayerViewModel();
      view.players = [fakePublicPlayerModel({color: 'blue', name: playerNames[viewAs] ?? 'blue'})];
      await holdView?.(saveId);
      const answer: ReplayViewModel = {saveId, viewAs, view, privates: []};
      return respond(answer);
    };
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mountScreen() {
    return shallowMount(ReplayScreen, {...globalConfig, props: {participantId: id}});
  }

  it('says the replay is not ready yet and offers a retry', async () => {
    movesAnswer = {status: 'not-finished'};
    const wrapper = mountScreen();
    await flushPromises();
    expect(wrapper.text()).to.contain('Replay is not ready yet');
    movesAnswer = {status: 'available', moves: [{saveId: 10, messages: []}]};
    await wrapper.find('.replay-retry').trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.to.contain('Replay is not ready yet');
    expect(calls.filter((c) => c.startsWith('api/replay/moves'))).has.length(2);
  });

  it('says the game was not found, without a retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (global as any).fetch = () => Promise.resolve({ok: false, status: 404, text: () => Promise.resolve('Not found: game not found')});
    const wrapper = mountScreen();
    await flushPromises();
    expect(wrapper.text()).to.contain('This game was not found.');
    expect(wrapper.text()).not.to.contain('Not found: game not found');
    expect(wrapper.find('.replay-retry').exists()).is.false;
  });

  it('offers a retry when the server cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (global as any).fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const wrapper = mountScreen();
    await flushPromises();
    expect(wrapper.text()).to.contain('Failed to fetch');
    expect(wrapper.find('.replay-retry').exists()).is.true;
  });

  it('says the replay has expired', async () => {
    movesAnswer = {status: 'expired'};
    const wrapper = mountScreen();
    await flushPromises();
    expect(wrapper.text()).to.contain('no longer available');
  });

  it('requests the view of the first move for all hands', async () => {
    const wrapper = mountScreen();
    await flushPromises();
    expect(calls).to.deep.equal([
      `api/replay/moves?id=${id}`,
      `api/replay/view?id=${id}&save=10&as=all`,
    ]);
    const home = wrapper.findComponent(SpectatorHome);
    expect(home.exists()).is.true;
    expect(home.props('replay')).is.true;
    expect(wrapper.findComponent(ReplayHands).exists()).is.true;
    expect(wrapper.findComponent(PlayerHome).exists()).is.false;
  });

  it('choosing a player loads that player view into PlayerHome', async () => {
    const wrapper = mountScreen();
    await flushPromises();
    wrapper.findComponent(ReplayPanel).vm.$emit('update:viewAs', 'blue');
    await flushPromises();
    expect(calls[calls.length - 1]).to.equal(`api/replay/view?id=${id}&save=10&as=blue`);
    const home = wrapper.findComponent(PlayerHome);
    expect(home.exists()).is.true;
    expect(home.props('replay')).is.true;
    expect(wrapper.findComponent(SpectatorHome).exists()).is.false;
    expect(wrapper.findComponent(ReplayHands).exists()).is.false;
  });

  it('selecting a move loads its view', async () => {
    const wrapper = mountScreen();
    await flushPromises();
    wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
    await flushPromises();
    expect(calls[calls.length - 1]).to.equal(`api/replay/view?id=${id}&save=11&as=all`);
  });

  it('autoplay advances one move per second at speed 1 and stops at the end', async () => {
    const wrapper = mountScreen();
    await flushPromises();
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const panel = () => wrapper.findComponent(ReplayPanel);
    panel().vm.$emit('play');
    await vi.advanceTimersByTimeAsync(0);
    expect(panel().props('playing')).is.true;
    await vi.advanceTimersByTimeAsync(999);
    expect(panel().props('index')).to.equal(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(panel().props('index')).to.equal(1);
    expect(calls[calls.length - 1]).to.equal(`api/replay/view?id=${id}&save=11&as=all`);
    expect(panel().props('playing')).is.false;
    const callCount = calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).has.length(callCount);
  });

  it('playing from the last move starts over from the first', async () => {
    const wrapper = mountScreen();
    await flushPromises();
    const panel = () => wrapper.findComponent(ReplayPanel);
    panel().vm.$emit('select', 1);
    await flushPromises();
    panel().vm.$emit('play');
    await flushPromises();
    expect(panel().props('index')).to.equal(0);
    expect(calls[calls.length - 1]).to.equal(`api/replay/view?id=${id}&save=10&as=all`);
    panel().vm.$emit('pause');
    await flushPromises();
    expect(panel().props('playing')).is.false;
  });

  describe('autoplay', () => {
    const threeMoves: ReplayMovesModel = {status: 'available', moves: [
      {saveId: 10, messages: []},
      {saveId: 11, messages: []},
      {saveId: 12, messages: []},
    ]};

    async function mountPlayable(moves: ReplayMovesModel = threeMoves) {
      movesAnswer = moves;
      const wrapper = mountScreen();
      await flushPromises();
      vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
      return wrapper;
    }

    it('stays on the last move when it is jumped to while playing', async () => {
      const wrapper = await mountPlayable();
      const panel = () => wrapper.findComponent(ReplayPanel);
      panel().vm.$emit('play');
      await vi.advanceTimersByTimeAsync(0);
      panel().vm.$emit('select', 2);
      await vi.advanceTimersByTimeAsync(5000);
      expect(panel().props('index')).to.equal(2);
      expect(panel().props('playing')).is.false;
      expect(wrapper.find('.replay-error').exists()).is.false;
      expect(calls.filter((c) => c.includes('save=12'))).has.length(1);
    });

    it('does nothing when playing a game of one move', async () => {
      const wrapper = await mountPlayable({status: 'available', moves: [{saveId: 10, messages: []}]});
      const panel = () => wrapper.findComponent(ReplayPanel);
      const callCount = calls.length;
      panel().vm.$emit('play');
      await vi.advanceTimersByTimeAsync(5000);
      expect(panel().props('index')).to.equal(0);
      expect(panel().props('playing')).is.false;
      expect(wrapper.find('.replay-error').exists()).is.false;
      expect(calls).has.length(callCount);
    });

    it('stops when another view is chosen', async () => {
      const wrapper = await mountPlayable();
      const panel = () => wrapper.findComponent(ReplayPanel);
      panel().vm.$emit('play');
      await vi.advanceTimersByTimeAsync(0);
      panel().vm.$emit('update:viewAs', 'blue');
      await vi.advanceTimersByTimeAsync(5000);
      expect(panel().props('playing')).is.false;
      expect(panel().props('index')).to.equal(0);
      expect(calls[calls.length - 1]).to.equal(`api/replay/view?id=${id}&save=10&as=blue`);
    });

    it('waits for a slow view before advancing again', async () => {
      const wrapper = await mountPlayable();
      const panel = () => wrapper.findComponent(ReplayPanel);
      let release!: () => void;
      holdView = (saveId) => saveId === 11 ? new Promise<void>((resolve) => release = resolve) : undefined;
      panel().vm.$emit('play');
      await vi.advanceTimersByTimeAsync(1000);
      expect(calls[calls.length - 1]).to.contain('save=11');
      // The view of move 2 is still on its way, however long that takes.
      await vi.advanceTimersByTimeAsync(10000);
      expect(calls.filter((c) => c.includes('save=12'))).has.length(0);
      expect(panel().props('index')).to.equal(1);
      holdView = undefined;
      release();
      await vi.advanceTimersByTimeAsync(0);
      expect(calls.filter((c) => c.includes('save=12'))).has.length(0);
      await vi.advanceTimersByTimeAsync(1000);
      expect(calls[calls.length - 1]).to.contain('save=12');
      expect(panel().props('index')).to.equal(2);
      expect(panel().props('playing')).is.false;
    });
  });

  it('puts the panel back on the move that is shown when a view fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mountScreen();
    await flushPromises();
    const working = (global as any).fetch;
    (global as any).fetch = (url: string) => url.startsWith('api/replay/view') ?
      Promise.resolve({ok: false, status: 404, text: () => Promise.resolve('Save not found')}) :
      working(url);
    const panel = () => wrapper.findComponent(ReplayPanel);
    panel().vm.$emit('select', 1);
    panel().vm.$emit('update:viewAs', 'blue');
    await flushPromises();
    expect(wrapper.text()).to.contain('Save not found');
    expect(panel().props('index')).to.equal(0);
    expect(panel().props('viewAs')).to.equal('all');
  });

  it('names players from the view that is shown, also for all hands', async () => {
    playerNames = {blue: 'Player view name', all: 'Spectator view name'};
    const wrapper = mountScreen();
    await flushPromises();
    const playerLog = {message: '${0}', data: [{type: LogMessageDataType.PLAYER, value: 'blue'}]} as any;
    expect(translateMessage({...playerLog})).to.equal('Spectator view name');
    wrapper.findComponent(ReplayPanel).vm.$emit('update:viewAs', 'blue');
    await flushPromises();
    expect(translateMessage({...playerLog})).to.equal('Player view name');
    wrapper.findComponent(ReplayPanel).vm.$emit('update:viewAs', 'all');
    await flushPromises();
    expect(translateMessage({...playerLog})).to.equal('Spectator view name');
  });

  it('shows the server message when the view cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (global as any).fetch = (url: string) => url.startsWith('api/replay/moves') ?
      respond(movesAnswer) :
      Promise.resolve({ok: false, status: 404, text: () => Promise.resolve('Save not found')});
    const wrapper = mountScreen();
    await flushPromises();
    expect(wrapper.text()).to.contain('Save not found');
  });
});
