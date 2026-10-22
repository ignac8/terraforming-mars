import {flushPromises, mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, beforeEach, vi} from 'vitest';
import {globalConfig} from '../getLocalVue';
import ReplayScreen from '@/client/components/replay/ReplayScreen.vue';
import ReplayPanel from '@/client/components/replay/ReplayPanel.vue';
import ReplayHands from '@/client/components/replay/ReplayHands.vue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import SpectatorHome from '@/client/components/SpectatorHome.vue';
import {fakeGameModel, fakePlayerViewModel, fakePublicPlayerModel, fakeSpectatorModel} from '../testHelpers';
import {ReplayMove, ReplayMovesModel, ReplayViewModel} from '@/common/replay/ReplayModel';
import {PlayerId, SpectatorId} from '@/common/Types';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import RewindControls from '@/client/components/replay/RewindControls.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import {CardName} from '@/common/cards/CardName';
import {translateMessage} from '@/client/directives/i18n';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {LogMessage} from '@/common/logs/LogMessage';

const id = 's-spectator-id' as SpectatorId;
const playerId = 'p-blue-id' as PlayerId;
const finishedGame = {finished: true, canRewind: false, defaultViewAs: 'all'} as const;
/** The messages of a move that was made. */
const played: Array<LogMessage> = [{message: 'Played', data: [], timestamp: 0}];

/** A player with something on the table, which is when the home screen shows its actions block. */
function playedView(overrides: Parameters<typeof fakePlayerViewModel>[0] = {}): PlayerViewModel {
  const thisPlayer = fakePublicPlayerModel({color: 'blue', tableau: [{name: CardName.ECOLINE}]});
  return fakePlayerViewModel({id: playerId, thisPlayer, players: [thisPlayer], ...overrides});
}

describe('ReplayScreen', () => {
  let originalFetch: any;
  let calls: Array<string>;
  let movesAnswer: ReplayMovesModel;
  /** Holds a view answer back until the returned promise resolves. */
  let holdView: ((saveId: number) => Promise<void> | undefined) | undefined;
  /** Names the players of the view it is asked about. */
  let playerNames: Record<string, string>;
  /** The POSTs to the rewind route. */
  let rewinds: Array<{url: string, body: unknown}>;
  let rewindAnswer: () => Promise<unknown>;

  function respond(body: unknown) {
    return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('')});
  }

  beforeEach(() => {
    originalFetch = (global as any).fetch;
    calls = [];
    holdView = undefined;
    playerNames = {};
    rewinds = [];
    rewindAnswer = () => respond(playedView());
    movesAnswer = {status: 'available', ...finishedGame, moves: [
      {saveId: 10, messages: []},
      {saveId: 11, messages: []},
    ]};
    (global as any).fetch = async (url: string, init?: {body?: unknown}) => {
      calls.push(url);
      if (url.startsWith('api/replay/moves')) {
        return respond(movesAnswer);
      }
      if (url.startsWith('api/rewind')) {
        rewinds.push({url, body: JSON.parse(init?.body as string)});
        return rewindAnswer();
      }
      const params = new URL(url, 'http://localhost/').searchParams;
      const viewAs = params.get('as') as ReplayViewModel['viewAs'];
      const saveId = Number(params.get('save'));
      const view = viewAs === 'all' ? fakeSpectatorModel() : playedView();
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
    PreferencesManager.INSTANCE.set('lang', 'en');
    delete (window as any)._translations;
  });

  function mountScreen() {
    return shallowMount(ReplayScreen, {...globalConfig, props: {participantId: id}});
  }

  it('says the replay is not ready yet and offers a retry', async () => {
    movesAnswer = {status: 'not-finished'};
    const wrapper = mountScreen();
    await flushPromises();
    expect(wrapper.text()).to.contain('Replay is not ready yet');
    movesAnswer = {status: 'available', ...finishedGame, moves: [{saveId: 10, messages: []}]};
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
    const threeMoves: ReplayMovesModel = {status: 'available', ...finishedGame, moves: [
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
      const wrapper = await mountPlayable({status: 'available', ...finishedGame, moves: [{saveId: 10, messages: []}]});
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
    // The shallow panel does not render the error slot.
    expect((wrapper.vm as any).error).to.contain('Save not found');
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

  it('shows a view-load error inside the panel, so the panel cannot cover it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mount(ReplayScreen, {
      ...globalConfig,
      props: {participantId: id},
      global: {...globalConfig.global, stubs: {PlayerHome: true, SpectatorHome: true, ReplayHands: true}},
    });
    await flushPromises();
    const working = (global as any).fetch;
    (global as any).fetch = (url: string) => url.startsWith('api/replay/view') ?
      Promise.resolve({ok: false, status: 404, text: () => Promise.resolve('Save not found')}) :
      working(url);
    wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
    await flushPromises();
    expect(wrapper.find('.replay-panel .replay-error--floating').text()).to.contain('Save not found');
  });

  describe('rewinding', () => {
    const rewindable = {finished: true, canRewind: true, defaultViewAs: 'all'} as const;

    beforeEach(() => {
      vi.stubGlobal('location', {href: 'http://localhost/replay'});
      movesAnswer = {status: 'available', ...rewindable, moves: [{saveId: 10, messages: []}, {saveId: 11, messages: []}]};
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function mountRewindable() {
      return shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {ReplayPanel: false}},
        props: {participantId: playerId},
      });
    }

    it('offers the rewind controls only when the moves answer allows a rewind', async () => {
      for (const canRewind of [true, false]) {
        movesAnswer = {status: 'available', ...rewindable, canRewind, moves: [{saveId: 10, messages: []}]};
        const wrapper = mountRewindable();
        await flushPromises();
        expect(wrapper.findComponent(RewindControls).exists(), String(canRewind)).equals(canRewind);
      }
    });

    it('rewinds to the selected move, then opens the game page of the player', async () => {
      const wrapper = mountRewindable();
      await flushPromises();
      wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
      await flushPromises();
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'shuffle');
      await flushPromises();
      expect(rewinds).to.deep.equal([{url: `api/rewind?id=${playerId}`, body: {saveId: 11, cards: 'shuffle'}}]);
      expect(window.location.href).to.equal(`player?id=${playerId}`);
    });

    it('shows the message of a refused rewind in the panel, under the rewind controls, and changes nothing', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      rewindAnswer = () => Promise.resolve({ok: false, status: 400, text: () => Promise.resolve('That moment cannot be rewound, nothing was changed')});
      const wrapper = mountRewindable();
      await flushPromises();
      wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
      await flushPromises();
      // The game lost its second move meanwhile, e.g. to a rewind from another page.
      movesAnswer = {status: 'available', ...rewindable, moves: [{saveId: 10, messages: []}]};
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'same');
      await flushPromises();
      const refusal = wrapper.find('.replay-panel .rewind-refusal');
      expect(refusal.text()).to.contain('nothing was changed');
      expect(refusal.element.previousElementSibling).to.equal(wrapper.findComponent(RewindControls).element);
      expect(wrapper.find('.replay-error--floating').exists()).is.false;
      expect(window.location.href).to.equal('http://localhost/replay');
      expect(wrapper.findComponent(SpectatorHome).exists()).is.true;
      // The list is read again, and the view is of a move it still has.
      expect(wrapper.findComponent(ReplayPanel).props('moves')).has.length(1);
      expect(calls[calls.length - 1]).to.contain('save=10');
      // It answers the move it was asked for, so picking another one clears it.
      wrapper.findComponent(ReplayPanel).vm.$emit('select', 0);
      await flushPromises();
      expect(wrapper.find('.rewind-refusal').exists()).is.false;
    });

    it('shows a refused rewind in the language of the player', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      PreferencesManager.INSTANCE.set('lang', 'pl');
      (window as any)._translations = {'A rewind is already running.': 'Cofanie gry już trwa.'};
      rewindAnswer = () => Promise.resolve({ok: false, status: 400, text: () => Promise.resolve('Bad request: A rewind is already running.')});
      const wrapper = mountRewindable();
      await flushPromises();
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'same');
      await flushPromises();
      expect(wrapper.find('.rewind-refusal').text()).to.equal('Cofanie gry już trwa.');
    });

    it('sends the seat password of the live game page', async () => {
      movesAnswer = {status: 'available', finished: false, canRewind: true, defaultViewAs: 'blue', moves: [{saveId: 10, messages: played}, {saveId: 11, messages: played}]};
      const wrapper = shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {ReplayPanel: false}},
        props: {participantId: playerId, liveView: playedView({password: '0123456789ab'})},
      });
      await wrapper.find('.replay-collapse').trigger('click');
      await flushPromises();
      wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
      await flushPromises();
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'same');
      await flushPromises();
      expect(rewinds.map((rewind) => rewind.url)).to.deep.equal([`api/rewind?id=${playerId}&password=0123456789ab`]);
    });
  });

  describe('on the live game page', () => {
    const liveMoves = {status: 'available', finished: false, canRewind: true, defaultViewAs: 'blue', moves: [
      {saveId: 10, messages: played},
      {saveId: 11, messages: played},
    ]} as const;
    const waitingFor = {type: 'option', title: 'Take your action', buttonLabel: 'OK'} as any;

    beforeEach(() => {
      movesAnswer = liveMoves as any;
    });

    function liveView(gameAge = 3): PlayerViewModel {
      return playedView({waitingFor, game: fakeGameModel({gameAge})});
    }

    function mountLive(view = liveView()) {
      return shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {PlayerHome: false, ReplayPanel: false}},
        props: {participantId: playerId, liveView: view},
      });
    }

    const panel = (wrapper: ReturnType<typeof mountLive>) => wrapper.findComponent(ReplayPanel);
    const expand = (wrapper: ReturnType<typeof mountLive>) => panel(wrapper).vm.$emit('update:collapsed', false);
    const moveRequests = () => calls.filter((c) => c.startsWith('api/replay/moves'));

    it('shows the live game with its inputs, and loads no moves until the panel is opened', async () => {
      const wrapper = mountLive();
      await flushPromises();
      expect(wrapper.findComponent(WaitingFor).exists()).is.true;
      expect(wrapper.findComponent(PlayerHome).props('replay')).is.false;
      expect(calls).to.deep.equal([]);
      expand(wrapper);
      await flushPromises();
      expect(calls).to.deep.equal([`api/replay/moves?id=${playerId}`]);
    });

    it('previews a move as the player with no way to send input, and comes back to the live game', async () => {
      const wrapper = mountLive();
      expand(wrapper);
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(calls[calls.length - 1]).to.equal(`api/replay/view?id=${playerId}&save=11&as=blue`);
      expect(wrapper.findComponent(PlayerHome).props('replay')).is.true;
      expect(wrapper.findComponent(WaitingFor).exists()).is.false;
      expect(wrapper.find('.player_home_block--actions').exists()).is.false;

      panel(wrapper).vm.$emit('back');
      await flushPromises();
      expect(wrapper.findComponent(WaitingFor).exists()).is.true;
      expect(wrapper.findComponent(PlayerHome).props('replay')).is.false;
    });

    it('shows no input while the first preview is still loading', async () => {
      const wrapper = mountLive();
      expand(wrapper);
      await flushPromises();
      let release!: () => void;
      holdView = () => new Promise<void>((resolve) => release = resolve);
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(wrapper.findComponent(WaitingFor).exists()).is.false;
      release();
      await flushPromises();
      expect(wrapper.findComponent(PlayerHome).props('replay')).is.true;
    });

    it('goes back to the live game with the reason when a preview cannot be loaded', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const wrapper = mountLive();
      expand(wrapper);
      await flushPromises();
      const working = (global as any).fetch;
      (global as any).fetch = (url: string) => url.startsWith('api/replay/view') ?
        Promise.resolve({ok: false, status: 400, text: () => Promise.resolve('Save not found')}) :
        working(url);
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(wrapper.findComponent(WaitingFor).exists()).is.true;
      expect(wrapper.find('.replay-error--floating').text()).to.contain('Save not found');
      expect(panel(wrapper).props('index')).is.undefined;
    });

    it('keeps the live game and shows the reason when the moves cannot be loaded', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      (global as any).fetch = () => Promise.resolve({ok: false, status: 400, text: () => Promise.resolve('Not your game')});
      const wrapper = mountLive();
      expand(wrapper);
      await flushPromises();
      expect(wrapper.findComponent(WaitingFor).exists()).is.true;
      expect(wrapper.find('.replay-error--floating').text()).to.contain('Not your game');
    });

    it('reads the moves and the live game again after a refused rewind', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const updatePlayer = vi.fn();
      const wrapper = shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {PlayerHome: false, ReplayPanel: false}, mocks: {updatePlayer}},
        props: {participantId: playerId, liveView: liveView()},
      });
      await wrapper.find('.replay-collapse').trigger('click');
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      // Another page rewound the game to before its second move.
      movesAnswer = {status: 'available', finished: false, canRewind: true, defaultViewAs: 'blue', moves: [{saveId: 10, messages: played}]};
      rewindAnswer = () => Promise.resolve({ok: false, status: 404, text: () => Promise.resolve('Not found: That move is not in this game\'s history.')});
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'same');
      await flushPromises();

      expect(panel(wrapper).props('moves')).has.length(1);
      expect(wrapper.findComponent(RewindControls).exists()).is.false;
      expect(wrapper.findComponent(WaitingFor).exists()).is.true;
      expect(updatePlayer.mock.calls).has.length(1);
      expect(wrapper.find('.rewind-refusal').text()).to.contain('not in this game');
    });

    it('drops the moves it listed when a reload after a refused rewind lists none', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const updatePlayer = vi.fn();
      const wrapper = shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {PlayerHome: false, ReplayPanel: false}, mocks: {updatePlayer}},
        props: {participantId: playerId, liveView: liveView()},
      });
      await wrapper.find('.replay-collapse').trigger('click');
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(wrapper.findComponent(RewindControls).exists()).is.true;
      // Another page rewound the game to its first move, which leaves no listed move.
      movesAnswer = {...liveMoves, moves: [{saveId: 10, messages: []}]};
      rewindAnswer = () => Promise.resolve({ok: false, status: 404, text: () => Promise.resolve('Not found: That move is not in this game\'s history.')});
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'same');
      await flushPromises();

      expect(wrapper.find('.rewind-refusal').exists()).is.true;
      expect(panel(wrapper).props('moves')).has.length(0);
      expect(panel(wrapper).props('canRewind')).is.false;
      expect(wrapper.findComponent(RewindControls).exists()).is.false;
    });

    it('lists no move for the live game itself, and keeps the last position of a finished game', async () => {
      for (const finished of [false, true]) {
        movesAnswer = {...liveMoves, finished, moves: [{saveId: 10, messages: played}, {saveId: 11, messages: []}]};
        const wrapper = mountLive();
        await wrapper.find('.replay-collapse').trigger('click');
        await flushPromises();
        expect(panel(wrapper).props('moves').map((move: ReplayMove) => move.saveId), String(finished)).to.deep.equal(finished ? [10, 11] : [10]);
      }
    });

    it('says there are no moves yet for a game whose only save is the live game itself', async () => {
      movesAnswer = {...liveMoves, moves: [{saveId: 10, messages: []}]};
      const wrapper = mountLive();
      await wrapper.find('.replay-collapse').trigger('click');
      await flushPromises();
      expect(wrapper.find('.replay-moves-empty').text()).to.equal('No moves yet');
      expect(wrapper.text()).not.to.contain('Replay is not ready yet');
      expect(wrapper.find('.replay-error--floating').exists()).is.false;
      // The empty list is known, so opening the panel again does not read it again.
      expect(moveRequests()).has.length(1);
    });

    it('reloads the moves when the game moves on while the panel is open, and not while it is closed', async () => {
      const wrapper = mountLive();
      await wrapper.setProps({liveView: liveView(4)});
      await flushPromises();
      expect(moveRequests()).has.length(0);
      expand(wrapper);
      await flushPromises();
      await wrapper.setProps({liveView: liveView(5)});
      await flushPromises();
      expect(moveRequests()).has.length(2);
      panel(wrapper).vm.$emit('update:collapsed', true);
      await wrapper.setProps({liveView: liveView(6)});
      await flushPromises();
      expect(moveRequests()).has.length(2);
      // Opened again, it catches up with what it missed.
      expand(wrapper);
      await flushPromises();
      expect(moveRequests()).has.length(3);
    });
  });
});
