import {flushPromises, mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, beforeEach, vi} from 'vitest';
import {globalConfig} from '../getLocalVue';
import ReplayScreen from '@/client/components/replay/ReplayScreen.vue';
import ReplayPanel from '@/client/components/replay/ReplayPanel.vue';
import ReplayHands from '@/client/components/replay/ReplayHands.vue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import SpectatorHome from '@/client/components/SpectatorHome.vue';
import {fakeGameModel, fakeGameOptionsModel, fakePlayerViewModel, fakePublicPlayerModel, fakeSpectatorModel, fakeTimerModel} from '../testHelpers';
import {ReplayMove, ReplayMovesModel, ReplayViewModel} from '@/common/replay/ReplayModel';
import {JudgeId, PlayerId, SpectatorId} from '@/common/Types';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {JudgeModel, JudgePlayerModel} from '@/common/models/JudgeModel';
import {PendingChoiceModel} from '@/common/models/PendingChoiceModel';
import JudgePendingChoice from '@/client/components/judge/JudgePendingChoice.vue';
import JudgeHome from '@/client/components/judge/JudgeHome.vue';
import RewindControls from '@/client/components/replay/RewindControls.vue';
import RewindVoteBanner from '@/client/components/replay/RewindVoteBanner.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import {CardName} from '@/common/cards/CardName';
import {translateMessage} from '@/client/directives/i18n';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {LogMessage} from '@/common/logs/LogMessage';

const id = 's-spectator-id' as SpectatorId;
const playerId = 'p-blue-id' as PlayerId;
const finishedGame = {finished: true, canRewind: false, canVoteRewind: false, defaultViewAs: 'all'} as const;
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
  /** The POSTs to the vote route. */
  let votes: Array<{url: string, body: unknown}>;
  /** What the vote route answers, to polls and to POSTs. */
  let voteAnswer: () => Promise<unknown>;
  /** The POSTs to the judge routes. */
  let judgeRequests: Array<{url: string, body: unknown}>;
  let judgeAnswer: () => Promise<unknown>;
  /** The players of the views it is asked about, when a test needs more than the one. */
  let pastPlayers: (() => Array<PublicPlayerModel>) | undefined;
  /** What the player of a player view was choosing among. */
  let pastChoice: PendingChoiceModel | undefined;
  /** Holds the answer to a moves request back until the returned promise resolves. */
  let holdMoves: (() => Promise<void>) | undefined;

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
    votes = [];
    voteAnswer = () => respond({rewindCount: 0, vote: undefined});
    judgeRequests = [];
    judgeAnswer = () => respond({});
    pastPlayers = undefined;
    pastChoice = undefined;
    holdMoves = undefined;
    movesAnswer = {status: 'available', ...finishedGame, moves: [
      {saveId: 10, messages: []},
      {saveId: 11, messages: []},
    ]};
    (global as any).fetch = async (url: string, init?: {body?: unknown}) => {
      calls.push(url);
      if (url.startsWith('api/replay/moves')) {
        await holdMoves?.();
        return respond(movesAnswer);
      }
      if (url.startsWith('api/judge/')) {
        judgeRequests.push({url, body: JSON.parse(init?.body as string)});
        return judgeAnswer();
      }
      if (url.startsWith('api/rewind/vote')) {
        if (init?.body !== undefined) {
          votes.push({url, body: JSON.parse(init.body as string)});
        }
        return voteAnswer();
      }
      if (url.startsWith('api/rewind')) {
        rewinds.push({url, body: JSON.parse(init?.body as string)});
        return rewindAnswer();
      }
      const params = new URL(url, 'http://localhost/').searchParams;
      const viewAs = params.get('as') as ReplayViewModel['viewAs'];
      const saveId = Number(params.get('save'));
      const view = viewAs === 'all' ? fakeSpectatorModel() : playedView();
      view.players = pastPlayers?.() ?? [fakePublicPlayerModel({color: 'blue', name: playerNames[viewAs] ?? 'blue'})];
      await holdView?.(saveId);
      const answer: ReplayViewModel = {saveId, viewAs, view, privates: [], pendingChoice: viewAs === 'all' ? undefined : pastChoice};
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
    const rewindable = {finished: true, canRewind: true, canVoteRewind: false, defaultViewAs: 'all'} as const;

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

    it('keeps the refusal on screen when the moves cannot be read again after it', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const wrapper = mountRewindable();
      await flushPromises();
      wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
      await flushPromises();
      const fetchOk = (global as any).fetch;
      (global as any).fetch = (url: string) => {
        if (url.startsWith('api/rewind')) {
          return Promise.resolve({ok: false, status: 400, text: () => Promise.resolve('That moment cannot be rewound, nothing was changed')});
        }
        return Promise.resolve({ok: false, status: 500, text: () => Promise.resolve('Server down')});
      };
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'same');
      await flushPromises();

      // The panel went with the moves, and stays gone.
      expect(wrapper.findComponent(ReplayPanel).exists()).is.false;
      expect(wrapper.find('.replay-error').text()).to.contain('Server down');
      expect(wrapper.find('.rewind-refusal').text()).to.contain('nothing was changed');
      (global as any).fetch = fetchOk;
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
      movesAnswer = {status: 'available', finished: false, canRewind: true, canVoteRewind: false, defaultViewAs: 'blue', moves: [{saveId: 10, messages: played}, {saveId: 11, messages: played}]};
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

  describe('on the replay URL of a table that votes on a rewind', () => {
    // The replay views carry no player ids, as a running game's model carries none.
    const blue = () => fakePublicPlayerModel({color: 'blue', id: undefined, name: 'blue'});
    const red = () => fakePublicPlayerModel({color: 'red', id: undefined, name: 'red'});

    function voteMoves(finished: boolean, canVoteRewind = true): ReplayMovesModel {
      const messages = finished ? [] : played;
      return {
        status: 'available', finished, canRewind: false, canVoteRewind, viewerColor: 'blue', defaultViewAs: finished ? 'all' : 'blue',
        moves: [{saveId: 10, messages, movers: ['blue']}, {saveId: 11, messages, movers: ['blue']}],
      };
    }

    beforeEach(() => {
      pastPlayers = () => [blue(), red()];
    });

    function mountReplay(real = false) {
      return shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {teleport: false, ReplayPanel: false, RewindControls: real ? false : true, RewindVoteBanner: !real}},
        props: {participantId: playerId},
      });
    }

    it('shows the vote controls and the banner to a player who may vote, and to no one else', async () => {
      for (const canVoteRewind of [true, false]) {
        movesAnswer = voteMoves(true, canVoteRewind);
        const wrapper = mountReplay();
        await flushPromises();
        wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
        await flushPromises();
        expect(wrapper.findComponent(RewindVoteBanner).exists(), String(canVoteRewind)).equals(canVoteRewind);
        expect(wrapper.findComponent(RewindControls).exists(), String(canVoteRewind)).equals(canVoteRewind);
        if (canVoteRewind) {
          expect(wrapper.findComponent(RewindControls).props('mode')).equals('vote');
        }
        wrapper.unmount();
      }
    });

    it('offers the request on the player\'s own moves only', async () => {
      for (const [index, offered] of [[0, true], [1, false]] as const) {
        movesAnswer = {
          status: 'available', finished: true, canRewind: false, canVoteRewind: true, viewerColor: 'blue', defaultViewAs: 'all',
          moves: [{saveId: 10, messages: [], movers: ['blue']}, {saveId: 11, messages: [], movers: ['red']}],
        };
        const wrapper = mountReplay();
        await flushPromises();
        wrapper.findComponent(ReplayPanel).vm.$emit('select', index);
        await flushPromises();
        expect(wrapper.findComponent(RewindControls).exists(), String(index)).equals(offered);
        wrapper.unmount();
      }
    });

    it('knows the seat of the player by colour, also when every hand is shown, so they can answer', async () => {
      movesAnswer = voteMoves(true);
      const vote = {voteId: 7, status: 'open', requester: 'red', saveId: 11, moveNumber: 2, generation: 1, cards: 'same', votes: [{color: 'blue', choice: 'pending'}], expiresInMs: 60_000};
      voteAnswer = () => respond({rewindCount: 0, vote});
      const wrapper = mountReplay(true);
      await flushPromises();
      expect(wrapper.find('.rewind-vote-yes').exists()).is.true;
    });

    it('polls a finished game slowly, and reads the seat password from the address bar', async () => {
      for (const [finished, pollMs] of [[true, 10_000], [false, 3000]] as const) {
        movesAnswer = voteMoves(finished);
        const wrapper = mountReplay();
        await flushPromises();
        const banner = wrapper.findComponent(RewindVoteBanner);
        expect(banner.props('pollMs'), String(finished)).equals(pollMs);
        expect(banner.props('password')).equals('');
        wrapper.unmount();
      }
    });

    it('lets a player of a running game pick no view but their own, and of a finished game any', async () => {
      for (const finished of [true, false]) {
        movesAnswer = voteMoves(finished);
        const wrapper = mountReplay();
        await flushPromises();
        expect(wrapper.find('.replay-view-as').exists(), String(finished)).equals(finished);
        wrapper.unmount();
      }
    });

    it('lets the solo player of a running game pick no view but their own, and the judge any', async () => {
      for (const [participantId, finished, shown] of [
        [playerId, true, true],
        [playerId, false, false],
        ['j-judge-id' as JudgeId, false, true],
      ] as const) {
        movesAnswer = {status: 'available', finished, canRewind: true, canVoteRewind: false, defaultViewAs: 'all', moves: [{saveId: 10, messages: finished ? [] : played}]};
        const wrapper = shallowMount(ReplayScreen, {
          ...globalConfig,
          global: {...globalConfig.global, stubs: {ReplayPanel: false, RewindControls: true, RewindVoteBanner: true}},
          props: {participantId},
        });
        await flushPromises();
        expect(wrapper.find('.replay-view-as').exists(), `${participantId} ${finished}`).equals(shown);
        wrapper.unmount();
      }
    });

    it('shows the vote at once after asking for it', async () => {
      movesAnswer = voteMoves(true);
      const wrapper = mountReplay(true);
      await flushPromises();
      const vote = {voteId: 7, status: 'open', requester: 'blue', saveId: 10, moveNumber: 1, generation: 1, cards: 'same', votes: [{color: 'red', choice: 'pending'}], expiresInMs: 60_000};
      voteAnswer = () => respond({rewindCount: 0, vote});
      expect(wrapper.find('.rewind-vote-open').exists()).is.false;
      await wrapper.find('.rewind-start').trigger('click');
      await wrapper.find('.rewind-confirm-button').trigger('click');
      await flushPromises();
      expect(votes).to.deep.equal([{url: `api/rewind/vote?id=${playerId}`, body: {action: 'request', saveId: 10, cards: 'same'}}]);
      expect(wrapper.find('.rewind-vote-open').exists()).is.true;
    });
  });

  describe('on the live game page', () => {
    const liveMoves = {status: 'available', finished: false, canRewind: true, canVoteRewind: false, defaultViewAs: 'blue', moves: [
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

    it('goes back to the live game when the move previewed has dropped out of the list', async () => {
      const wrapper = mountLive();
      expand(wrapper);
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(panel(wrapper).props('index')).equals(1);

      // Save 11 was saved again in place, so its range holds no line of its own and the list leaves it out.
      movesAnswer = {...liveMoves, moves: [{saveId: 10, messages: played}, {saveId: 12, messages: played}]};
      await wrapper.setProps({liveView: liveView(4)});
      await flushPromises();
      expect(panel(wrapper).props('index')).is.undefined;
      expect(wrapper.findComponent(WaitingFor).exists()).is.true;
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
      movesAnswer = {status: 'available', finished: false, canRewind: true, canVoteRewind: false, defaultViewAs: 'blue', moves: [{saveId: 10, messages: played}]};
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

    it('clears a refusal at the next game update, not at the update that answers it', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      // The refresh after the refusal brings the game as it is now.
      const updatePlayer = vi.fn(() => wrapper.setProps({liveView: liveView(4)}));
      const wrapper = shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {PlayerHome: false, ReplayPanel: false}, mocks: {updatePlayer}},
        props: {participantId: playerId, liveView: liveView()},
      });
      await wrapper.find('.replay-collapse').trigger('click');
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      rewindAnswer = () => Promise.resolve({ok: false, status: 404, text: () => Promise.resolve('Not found: That move is not in this game\'s history.')});
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'same');
      await flushPromises();
      expect(wrapper.find('.rewind-refusal').exists()).is.true;

      await wrapper.setProps({liveView: liveView(5)});
      await flushPromises();
      expect(wrapper.find('.rewind-refusal').exists()).is.false;
    });

    it('still reads the moves and settles the refusal when the refresh of the live game fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const updatePlayer = vi.fn(() => Promise.reject(new Error('refresh failed')));
      const wrapper = shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {PlayerHome: false, ReplayPanel: false}, mocks: {updatePlayer}},
        props: {participantId: playerId, liveView: liveView()},
      });
      await wrapper.find('.replay-collapse').trigger('click');
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      rewindAnswer = () => Promise.resolve({ok: false, status: 404, text: () => Promise.resolve('Not found: That move is not in this game\'s history.')});
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'same');
      await flushPromises();
      expect(moveRequests()).has.length(2);
      expect(wrapper.find('.rewind-refusal').exists()).is.true;

      await wrapper.setProps({liveView: liveView(4)});
      await flushPromises();
      expect(wrapper.find('.rewind-refusal').exists()).is.false;
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

    it('sends the seat password with the history requests', async () => {
      const wrapper = mountLive(playedView({waitingFor, game: fakeGameModel({gameAge: 3}), password: '0123456789ab'}));
      expand(wrapper);
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(calls).to.deep.equal([
        `api/replay/moves?id=${playerId}&password=0123456789ab`,
        `api/replay/view?id=${playerId}&save=11&as=blue&password=0123456789ab`,
      ]);
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

    describe('at a table that votes on a rewind', () => {
      const voteMoves = {
        ...liveMoves, canRewind: false, canVoteRewind: true, viewerColor: 'blue',
        moves: [{saveId: 10, messages: played, movers: ['blue']}, {saveId: 11, messages: played, movers: ['blue']}],
      } as const;
      // A running game's model leaves the players' ids out.
      const red = () => fakePublicPlayerModel({color: 'red', id: undefined, name: 'red'});

      function voteView(gameOptions: Parameters<typeof fakeGameOptionsModel>[0] = {undoOption: true}, players = 2): PlayerViewModel {
        return playedView({
          waitingFor,
          players: [fakePublicPlayerModel({color: 'blue', id: undefined}), red()].slice(0, players),
          game: fakeGameModel({gameAge: 3, gameOptions: fakeGameOptionsModel(gameOptions)}),
        });
      }

      function mountVote(real: boolean, view = voteView()) {
        return shallowMount(ReplayScreen, {
          ...globalConfig,
          global: {...globalConfig.global, stubs: {teleport: false, PlayerHome: false, ReplayPanel: false, RewindControls: !real, RewindVoteBanner: !real}},
          props: {participantId: playerId, liveView: view},
        });
      }

      /** Opens the panel the way a player does, which the panel keeps to itself. */
      const open = (wrapper: ReturnType<typeof mountLive>) => wrapper.find('.replay-collapse').trigger('click');

      beforeEach(() => {
        movesAnswer = voteMoves as any;
      });

      it('shows the vote banner to the players of a table with Player undo, and to no one else', async () => {
        for (const [gameOptions, players, shown] of [
          [{undoOption: true}, 2, true],
          [{undoOption: false}, 2, false],
          [{undoOption: true, judgeUndo: true}, 2, true],
          [{undoOption: false, judgeUndo: true}, 2, false],
          [{undoOption: true}, 1, false],
        ] as const) {
          const wrapper = mountVote(false, voteView(gameOptions, players));
          expect(wrapper.findComponent(RewindVoteBanner).exists(), JSON.stringify([gameOptions, players])).equals(shown);
          wrapper.unmount();
        }
      });

      it('lets the player answer a vote on the page', async () => {
        const vote = {voteId: 7, status: 'open', requester: 'red', saveId: 11, moveNumber: 2, generation: 1, cards: 'same', votes: [{color: 'blue', choice: 'pending'}], expiresInMs: 60_000};
        voteAnswer = () => respond({rewindCount: 0, vote});
        const wrapper = mountVote(true);
        await flushPromises();
        expect(wrapper.find('.rewind-vote-yes').exists()).is.true;
      });

      it('gives the banner the players, the rewind count and the password of the page', async () => {
        const wrapper = mountVote(false, {...voteView(), password: '0123456789ab', game: fakeGameModel({rewindCount: 3, gameOptions: fakeGameOptionsModel({undoOption: true})})});
        const banner = wrapper.findComponent(RewindVoteBanner);
        expect(banner.props('participantId')).to.equal(playerId);
        expect(banner.props('rewindCount')).to.equal(3);
        expect(banner.props('password')).to.equal('&password=0123456789ab');
        expect(banner.props('players')).has.length(2);
      });

      it('asks the others to rewind to the selected move, as a request for a vote', async () => {
        const wrapper = mountVote(false, {...voteView(), password: '0123456789ab'});
        await open(wrapper);
        await flushPromises();
        panel(wrapper).vm.$emit('select', 1);
        await flushPromises();
        const controls = wrapper.findComponent(RewindControls);
        expect(controls.props('mode')).to.equal('vote');
        controls.vm.$emit('request', 'shuffle');
        await flushPromises();
        expect(votes).to.deep.equal([{url: `api/rewind/vote?id=${playerId}&password=0123456789ab`, body: {action: 'request', saveId: 11, cards: 'shuffle'}}]);
        expect(rewinds).to.deep.equal([]);
      });

      it('shows the vote at once after asking for it, without waiting for the next poll', async () => {
        const wrapper = mountVote(true);
        await flushPromises();
        await open(wrapper);
        await flushPromises();
        panel(wrapper).vm.$emit('select', 0);
        await flushPromises();
        const vote = {voteId: 7, status: 'open', requester: 'blue', saveId: 10, moveNumber: 1, generation: 1, cards: 'same', votes: [{color: 'red', choice: 'pending'}], expiresInMs: 60_000};
        voteAnswer = () => respond({rewindCount: 0, vote});
        expect(wrapper.find('.rewind-vote-open').exists()).is.false;
        await wrapper.find('.rewind-start').trigger('click');
        await wrapper.find('.rewind-confirm-button').trigger('click');
        await flushPromises();
        expect(wrapper.find('.rewind-vote-open').exists()).is.true;
      });

      it('shows why a request was refused, where view errors show', async () => {
        const wrapper = mountVote(false);
        await open(wrapper);
        await flushPromises();
        panel(wrapper).vm.$emit('select', 0);
        await flushPromises();
        voteAnswer = () => Promise.resolve({ok: false, status: 400, text: () => Promise.resolve('Bad request: A rewind vote is already open.')});
        wrapper.findComponent(RewindControls).vm.$emit('request', 'same');
        await flushPromises();
        expect(wrapper.find('.replay-error--floating').text()).to.equal('A rewind vote is already open.');
      });

      it('goes back to the live game and reads the moves again when the table was rewound under it, and not when it was frozen', async () => {
        for (const rewound of [true, false]) {
          const wrapper = mountVote(false);
          await open(wrapper);
          await flushPromises();
          panel(wrapper).vm.$emit('select', 1);
          await flushPromises();
          expect(panel(wrapper).props('index')).to.equal(1);
          const read = moveRequests().length;
          const next = voteView();
          // A freeze changes the undo count too.
          next.game = fakeGameModel({gameAge: 3, undoCount: 1, rewindCount: rewound ? 1 : 0, gameOptions: fakeGameOptionsModel({undoOption: true})});
          await wrapper.setProps({liveView: next});
          await flushPromises();
          expect(panel(wrapper).props('index'), String(rewound)).equals(rewound ? undefined : 1);
          expect(wrapper.findComponent(PlayerHome).props('replay'), String(rewound)).equals(!rewound);
          expect(moveRequests(), String(rewound)).to.have.length(rewound ? read + 1 : read);
          wrapper.unmount();
        }
      });

      it('keeps the banner while a past move is previewed', async () => {
        const wrapper = mountVote(false);
        await open(wrapper);
        await flushPromises();
        panel(wrapper).vm.$emit('select', 1);
        await flushPromises();
        expect(wrapper.findComponent(PlayerHome).props('replay')).is.true;
        expect(wrapper.findComponent(RewindVoteBanner).exists()).is.true;
      });

      it('shows the move of the vote, reading the moves first when the panel never did', async () => {
        const wrapper = mountVote(false);
        wrapper.findComponent(RewindVoteBanner).vm.$emit('show', 11);
        await flushPromises();
        expect(calls).to.deep.equal([
          `api/replay/moves?id=${playerId}`,
          `api/replay/view?id=${playerId}&save=11&as=blue`,
        ]);
        expect(panel(wrapper).props('index')).to.equal(1);
      });

      it('drops the refusal of a request for an open vote once the vote has ended', async () => {
        const vote = {voteId: 7, status: 'open', requester: 'red', saveId: 11, moveNumber: 2, generation: 1, cards: 'same', votes: [{color: 'blue', choice: 'pending'}], expiresInMs: 60_000};
        let voteOpen = false;
        let refused = 0;
        voteAnswer = () => {
          if (votes.length > refused) {
            // The player asked just as someone else's vote opened.
            refused = votes.length;
            voteOpen = true;
            return Promise.resolve({ok: false, status: 400, json: () => Promise.reject(new Error('no json')), text: () => Promise.resolve('Bad request: A rewind vote is already open.')});
          }
          return respond(voteOpen ? {rewindCount: 0, vote, blocked: 'vote-open'} : {rewindCount: 0, vote: undefined});
        };
        const wrapper = mountVote(true);
        await flushPromises();
        await open(wrapper);
        await flushPromises();
        panel(wrapper).vm.$emit('select', 0);
        await flushPromises();
        await wrapper.find('.rewind-start').trigger('click');
        await wrapper.find('.rewind-confirm-button').trigger('click');
        await flushPromises();
        expect(wrapper.find('.replay-error--floating').text()).equals('A rewind vote is already open.');

        voteOpen = false;
        await (wrapper.findComponent(RewindVoteBanner).vm as any).refresh();
        await flushPromises();
        expect(wrapper.find('.replay-error--floating').exists()).is.false;
      });

      it('disables the request while the banner says the player may not ask', async () => {
        for (const blocked of ['barred', 'frozen', 'vote-open', undefined] as const) {
          voteAnswer = () => respond({rewindCount: 0, vote: undefined, blocked});
          const wrapper = mountVote(true);
          await flushPromises();
          await open(wrapper);
          await flushPromises();
          panel(wrapper).vm.$emit('select', 0);
          await flushPromises();
          expect(wrapper.find('.rewind-start').attributes('disabled') === undefined, String(blocked)).equals(blocked === undefined);
          wrapper.unmount();
        }
      });
    });
  });

  describe('on the judge page', () => {
    const judgeId = 'j-judge-id' as JudgeId;
    const judgeMoves = {status: 'available', finished: false, canRewind: true, canVoteRewind: false, defaultViewAs: 'all', moves: [
      {saveId: 10, messages: played},
      {saveId: 11, messages: played},
    ]} as const;
    const hour = 3_600_000;
    const withClock = (color: 'blue' | 'red', name: string, sumElapsed: number) =>
      fakePublicPlayerModel({color, name, id: undefined, timer: {...fakeTimerModel(), sumElapsed}});

    beforeEach(() => {
      movesAnswer = judgeMoves as any;
      vi.stubGlobal('location', {href: `http://localhost/judge?id=${judgeId}`, search: '', reload: vi.fn()});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** A running game's model leaves the players' ids out. */
    function judgeModel(game: Parameters<typeof fakeGameModel>[0] = {}, password?: string): JudgeModel {
      const players = [withClock('blue', 'Blue player', 80 * 60_000), withClock('red', 'Red player', 30 * 60_000)];
      return {
        game: fakeGameModel({gameAge: 3, gameOptions: fakeGameOptionsModel({judgeUndo: true}), ...game}),
        players,
        thisPlayer: undefined,
        runId: 'run-id',
        id: judgeId,
        color: 'neutral',
        password,
        signature: 'sig',
        privates: [],
      };
    }

    function mountJudge(judge = judgeModel(), mocks: Record<string, unknown> = {}) {
      return shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {ReplayPanel: false, RewindControls: false}, mocks},
        props: {participantId: judgeId, liveJudge: judge},
      });
    }

    const panel = (wrapper: ReturnType<typeof mountJudge>) => wrapper.findComponent(ReplayPanel);
    /** Opens the panel the way the judge does, which the panel keeps to itself. */
    const expand = (wrapper: ReturnType<typeof mountJudge>) => wrapper.find('.replay-collapse').trigger('click');

    async function rewindTo(wrapper: ReturnType<typeof mountJudge>, index: number, choose: Array<string> = []) {
      expand(wrapper);
      await flushPromises();
      panel(wrapper).vm.$emit('select', index);
      await flushPromises();
      for (const value of choose) {
        await wrapper.find(`.rewind-controls input[value=${value}]`).setValue(true);
      }
      await wrapper.find('.rewind-start').trigger('click');
      await wrapper.find('.rewind-confirm-button').trigger('click');
      await flushPromises();
    }

    it('shows the judge page, and previews a move for all hands', async () => {
      const wrapper = mountJudge();
      await flushPromises();
      expect(wrapper.findComponent(JudgeHome).props('judge')).to.equal(wrapper.props('liveJudge'));
      expect(calls).to.deep.equal([]);
      expand(wrapper);
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(calls[calls.length - 1]).to.equal(`api/replay/view?id=${judgeId}&save=11&as=all`);
      expect(wrapper.findComponent(SpectatorHome).props('replay')).is.true;
      expect(wrapper.findComponent(ReplayHands).exists()).is.true;
      expect(wrapper.findComponent(JudgeHome).exists()).is.false;

      panel(wrapper).vm.$emit('back');
      await flushPromises();
      expect(wrapper.findComponent(JudgeHome).exists()).is.true;
      expect(wrapper.findComponent(SpectatorHome).exists()).is.false;
    });

    it('shows the live game as the player the judge picks, kept up to date, with no input', async () => {
      const privates = (color: 'blue' | 'red', hand: CardName): JudgePlayerModel => ({
        color,
        cardsInHand: [{name: hand}],
        ceoCardsInHand: [],
        dealtCorporationCards: [],
        dealtPreludeCards: [],
        dealtCeoCards: [],
        dealtProjectCards: [],
        draftedCards: [],
        pickedCorporationCard: [],
        preludeCardsInHand: [],
        waitingFor: {type: 'or', title: 'Take your first action', buttonLabel: 'Confirm', options: [], initialIdx: 0},
      } as JudgePlayerModel);
      const judge = {...judgeModel(), allVictoryPoints: true, privates: [privates('blue', CardName.BIRDS), privates('red', CardName.ANTS)]};
      const wrapper = mountJudge(judge);
      await flushPromises();
      const home = () => wrapper.findComponent(PlayerHome);
      const shown = () => home().props('playerView') as PlayerViewModel;

      panel(wrapper).vm.$emit('update:viewAs', 'red');
      await flushPromises();
      expect(calls).to.deep.equal([]);
      expect(wrapper.findComponent(JudgeHome).exists()).is.false;
      expect(home().props('replay')).is.true;
      expect(shown().thisPlayer?.color).equals('red');
      expect(shown().cardsInHand.map((card) => card.name)).to.deep.equal([CardName.ANTS]);
      expect(shown().waitingFor).is.undefined;
      expect(shown().id).equals(judgeId);
      expect(shown().allVictoryPoints).is.true;
      // The judge page still polls, as JudgeHome does when it shows, and the log is the judge's.
      expect(wrapper.findComponent(WaitingFor).props('playerView')).equals(wrapper.props('liveJudge'));
      expect(home().props('log')).equals(wrapper.props('liveJudge'));
      expect(home().props('showUndone')).is.false;

      await wrapper.setProps({liveJudge: {...judge, privates: [privates('blue', CardName.BIRDS), privates('red', CardName.TARDIGRADES)]}});
      expect(shown().cardsInHand.map((card) => card.name)).to.deep.equal([CardName.TARDIGRADES]);

      // Reading the moves when the panel opens keeps the pick.
      expand(wrapper);
      await flushPromises();
      expect(shown().thisPlayer?.color).equals('red');
      expect(wrapper.find('.replay-view-active').text()).equals('Red player');

      panel(wrapper).vm.$emit('update:viewAs', 'all');
      await flushPromises();
      expect(wrapper.findComponent(JudgeHome).exists()).is.true;
      expect(home().exists()).is.false;
    });

    it('shows what the player viewed as was choosing among at a past move, and at the live game', async () => {
      pastChoice = {title: 'Select card(s) to buy', cards: [{name: CardName.COMET}, {name: CardName.ANTS}]};
      const offer = {type: 'card', title: 'Select card(s) to buy', buttonLabel: 'Buy', cards: [{name: CardName.BIRDS}, {name: CardName.ANTS}], min: 0, max: 2} as const;
      const red = {
        color: 'red', cardsInHand: [{name: CardName.ANTS}], ceoCardsInHand: [], dealtCorporationCards: [], dealtPreludeCards: [],
        dealtCeoCards: [], dealtProjectCards: [], draftedCards: [], pickedCorporationCard: [], preludeCardsInHand: [], waitingFor: offer,
      } as unknown as JudgePlayerModel;
      const wrapper = mountJudge({...judgeModel(), privates: [red]});
      await flushPromises();
      const choice = () => wrapper.findComponent(JudgePendingChoice);

      panel(wrapper).vm.$emit('update:viewAs', 'red');
      await flushPromises();
      expect(choice().props('choice')).to.deep.equal({title: 'Select card(s) to buy', cards: [{name: CardName.BIRDS}, {name: CardName.ANTS}]});
      expect(choice().props('shown')).to.include(CardName.ANTS);

      expand(wrapper);
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(wrapper.findComponent(PlayerHome).props('playerView').thisPlayer.tableau.map((c: {name: CardName}) => c.name)).to.deep.equal([CardName.ECOLINE]);
      expect(choice().props('choice')).to.deep.equal(pastChoice);
      expect(choice().props('shown')).to.deep.equal([CardName.ECOLINE]);

      panel(wrapper).vm.$emit('update:viewAs', 'all');
      await flushPromises();
      expect(choice().exists()).is.false;
    });

    it('rewinds to the selected move with the cards and clocks chosen, then reloads the page', async () => {
      const wrapper = mountJudge();
      await flushPromises();
      await rewindTo(wrapper, 1, ['shuffle', 'keep']);
      expect(judgeRequests).to.deep.equal([{url: `api/judge/rewind?id=${judgeId}`, body: {saveId: 11, cards: 'shuffle', clocks: 'keep'}}]);
      expect(rewinds).to.deep.equal([]);
      expect((window.location.reload as ReturnType<typeof vi.fn>).mock.calls).has.length(1);
    });

    it('puts each clock beside the same player\'s clock at the selected move, whatever order the past view lists them in', async () => {
      pastPlayers = () => [withClock('red', 'Red player', 20 * 60_000), withClock('blue', 'Blue player', hour)];
      const wrapper = mountJudge();
      expand(wrapper);
      await flushPromises();
      panel(wrapper).vm.$emit('select', 0);
      await flushPromises();
      const rows = wrapper.findAll('.rewind-clock-row').map((row) => row.findAll('td').map((cell) => cell.text()));
      expect(rows).to.deep.equal([['Red player', '30:00', '20:00'], ['Blue player', '1:20:00', '1:00:00']]);
    });

    it('leaves out the clocks at a move until its view has loaded', async () => {
      pastPlayers = () => [withClock('blue', 'Blue player', hour)];
      const wrapper = mountJudge();
      expand(wrapper);
      await flushPromises();
      const atMove = () => wrapper.findAll('.rewind-clock-row').map((row) => row.findAll('td')[2].text());
      let release = () => {};
      holdView = (saveId) => saveId === 11 ? new Promise((resolve) => release = () => resolve()) : undefined;
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(atMove()).to.deep.equal(['…', '…']);
      release();
      await flushPromises();
      expect(atMove()).to.deep.equal(['1:00:00']);
    });

    it('goes back to the live game and reads it again when the rewind is refused', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      judgeAnswer = () => Promise.resolve({ok: false, status: 400, text: () => Promise.resolve('Bad request: That move is not in this game\'s history.')});
      const updateJudge = vi.fn();
      const wrapper = mountJudge(judgeModel(), {updateJudge});
      await rewindTo(wrapper, 1);
      expect((window.location.reload as ReturnType<typeof vi.fn>).mock.calls).is.empty;
      expect(updateJudge.mock.calls).has.length(1);
      expect(wrapper.findComponent(JudgeHome).exists()).is.true;
      expect(wrapper.find('.replay-panel .rewind-refusal').text()).equals('That move is not in this game\'s history.');
    });

    it('freezes and unfreezes the game, then reads the game again', async () => {
      for (const frozen of [false, true]) {
        judgeRequests = [];
        const updateJudge = vi.fn();
        const wrapper = mountJudge(judgeModel({frozen}), {updateJudge});
        await flushPromises();
        await wrapper.find('.replay-freeze').trigger('click');
        await flushPromises();
        expect(judgeRequests, String(frozen)).to.deep.equal([{url: `api/judge/freeze?id=${judgeId}`, body: {frozen: !frozen}}]);
        expect(updateJudge.mock.calls, String(frozen)).has.length(1);
        wrapper.unmount();
      }
    });

    it('sends the password of the claimed seat, from the judge page and not from the address bar', async () => {
      const wrapper = mountJudge(judgeModel({}, 'abc'));
      await flushPromises();
      await rewindTo(wrapper, 1);
      const frozen = mountJudge(judgeModel({}, 'abc'), {updateJudge: vi.fn()});
      await flushPromises();
      await frozen.find('.replay-freeze').trigger('click');
      await flushPromises();
      expect(judgeRequests.map(({url}) => url)).to.deep.equal([`api/judge/rewind?id=${judgeId}&password=abc`, `api/judge/freeze?id=${judgeId}&password=abc`]);
    });

    it('shows why a freeze was refused in the panel', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      judgeAnswer = () => Promise.resolve({ok: false, status: 400, text: () => Promise.resolve('Bad request: The game is already frozen.')});
      const updateJudge = vi.fn();
      const wrapper = mountJudge(judgeModel(), {updateJudge});
      await flushPromises();
      await wrapper.find('.replay-freeze').trigger('click');
      await flushPromises();
      expect(wrapper.find('.replay-panel .rewind-refusal').text()).equals('The game is already frozen.');
      // The change may have been made all the same, as when the freeze was not saved.
      expect(updateJudge.mock.calls).has.length(1);
    });

    it('offers no freeze for a finished game', async () => {
      const wrapper = mountJudge(judgeModel({phase: 'end'}));
      await flushPromises();
      expect(wrapper.find('.replay-freeze').exists()).is.false;
    });

    describe('the undone moves', () => {
      const withUndone = {...judgeMoves, moves: [
        {saveId: 10, messages: played},
        {saveId: 11, messages: played, undone: true},
        {saveId: 12, messages: played},
      ]} as any;
      const movesCalls = () => calls.filter((url) => url.startsWith('api/replay/moves'));
      const switchOf = (wrapper: ReturnType<typeof mountJudge>) => wrapper.find('.replay-show-undone input');

      it('are off when the page loads, and read again with the parameter when the switch is turned on and off', async () => {
        const wrapper = mountJudge();
        expand(wrapper);
        await flushPromises();
        expect(movesCalls()).to.deep.equal([`api/replay/moves?id=${judgeId}`]);
        expect(wrapper.findComponent(JudgeHome).props('showUndone')).is.false;

        movesAnswer = withUndone;
        await switchOf(wrapper).setValue(true);
        await flushPromises();
        expect(movesCalls()[1]).to.equal(`api/replay/moves?id=${judgeId}&undone=1`);
        expect(wrapper.findComponent(JudgeHome).props('showUndone')).is.true;
        expect(wrapper.findAll('.replay-move-undone')).to.have.length(1);

        movesAnswer = judgeMoves as any;
        await switchOf(wrapper).setValue(false);
        await flushPromises();
        expect(movesCalls()[2]).to.equal(`api/replay/moves?id=${judgeId}`);
        expect(wrapper.findComponent(JudgeHome).props('showUndone')).is.false;
      });

      it('are previewed with the parameter, and rewound to through the judge route with the clocks going back', async () => {
        movesAnswer = withUndone;
        const wrapper = mountJudge();
        expand(wrapper);
        await flushPromises();
        await switchOf(wrapper).setValue(true);
        await flushPromises();

        for (const [index, saveId, undone] of [[2, 12, false], [1, 11, true]] as const) {
          panel(wrapper).vm.$emit('select', index);
          await flushPromises();
          expect(calls[calls.length - 1], String(index)).to.equal(`api/replay/view?id=${judgeId}&save=${saveId}&as=all${undone ? '&undone=1' : ''}`);
          expect(wrapper.find('.rewind-controls').exists(), String(index)).is.true;
        }
        expect((wrapper.find('.rewind-controls input[value=back]').element as HTMLInputElement).checked).is.true;
        await wrapper.find('.rewind-start').trigger('click');
        expect(wrapper.find('.rewind-confirm-undone').exists()).is.true;
        await wrapper.find('.rewind-confirm-button').trigger('click');
        await flushPromises();
        expect(judgeRequests).to.deep.equal([{url: `api/judge/rewind?id=${judgeId}`, body: {saveId: 11, cards: 'same', clocks: 'back'}}]);
      });

      it('stay on the move that is shown when the list changes, and go back to the live game when it is gone', async () => {
        movesAnswer = withUndone;
        const wrapper = mountJudge();
        expand(wrapper);
        await flushPromises();
        await switchOf(wrapper).setValue(true);
        await flushPromises();
        panel(wrapper).vm.$emit('select', 2);
        await flushPromises();

        // Move 12 is index 1 once the undone move is out of the list.
        const withoutUndone = {...judgeMoves, moves: [{saveId: 10, messages: played}, {saveId: 12, messages: played}]} as any;
        movesAnswer = withoutUndone;
        await switchOf(wrapper).setValue(false);
        await flushPromises();
        expect(panel(wrapper).props('index')).equals(1);

        movesAnswer = withUndone;
        await switchOf(wrapper).setValue(true);
        await flushPromises();
        panel(wrapper).vm.$emit('select', 1);
        await flushPromises();
        movesAnswer = withoutUndone;
        await switchOf(wrapper).setValue(false);
        await flushPromises();
        expect(panel(wrapper).props('index')).is.undefined;
        expect(wrapper.findComponent(JudgeHome).exists()).is.true;
      });

      it('keep the board on screen while the list is read again, and move to the nearest move when the one shown is gone', async () => {
        for (const [remaining, shown] of [[[10, 12], 10], [[12, 13], 12]] as Array<[Array<number>, number]>) {
          movesAnswer = withUndone;
          const wrapper = shallowMount(ReplayScreen, {
            ...globalConfig,
            global: {...globalConfig.global, stubs: {ReplayPanel: false, RewindControls: false}},
            props: {participantId: judgeId},
          });
          await flushPromises();
          await switchOf(wrapper).setValue(true);
          await flushPromises();
          panel(wrapper).vm.$emit('select', 1);
          await flushPromises();
          expect(calls[calls.length - 1]).to.equal(`api/replay/view?id=${judgeId}&save=11&as=all&undone=1`);

          let release = () => {};
          holdMoves = () => new Promise((resolve) => {
            release = resolve;
          });
          movesAnswer = {...judgeMoves, moves: remaining.map((saveId) => ({saveId, messages: played}))} as any;
          await switchOf(wrapper).setValue(false);
          await flushPromises();
          expect(wrapper.findComponent(SpectatorHome).exists(), String(remaining)).is.true;
          expect(wrapper.text(), String(remaining)).not.to.contain('Loading replay...');

          holdMoves = undefined;
          release();
          await flushPromises();
          expect(calls[calls.length - 1], String(remaining)).to.equal(`api/replay/view?id=${judgeId}&save=${shown}&as=all`);
          expect(panel(wrapper).props('index'), String(remaining)).equals(remaining.indexOf(shown));
          wrapper.unmount();
        }
      });

      it('are offered to the judge of a game that allows it and to the solo player, and to no one else', async () => {
        // A player's moves answer allows a rewind only to the player of a solo game.
        for (const [participantId, canRewind, expected] of [[judgeId, true, true], [judgeId, false, false], [playerId, true, true], [playerId, false, false], [id, true, false]] as const) {
          movesAnswer = {...judgeMoves, canRewind} as any;
          const wrapper = shallowMount(ReplayScreen, {...globalConfig, props: {participantId}});
          await flushPromises();
          expect(wrapper.findComponent(ReplayPanel).props('canShowUndone'), `${participantId} ${canRewind}`).equals(expected);
          wrapper.unmount();
        }
      });
    });

    it('rewinds from the replay page through the judge route, and goes back to the judge page with the password', async () => {
      vi.stubGlobal('location', {href: `http://localhost/replay?id=${judgeId}`, search: '?id=j-judge-id&password=a%26b&serverId=1', reload: vi.fn()});
      const wrapper = shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {ReplayPanel: false, RewindControls: false}},
        props: {participantId: judgeId},
      });
      await flushPromises();
      wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
      await flushPromises();
      // It has no live game to show a clock beside, so only the clocks at the move show.
      expect(wrapper.findAll('.rewind-clock-row')).to.have.length(1);
      expect(wrapper.find('.rewind-clock-row').findAll('td')).to.have.length(2);
      await wrapper.find('.rewind-start').trigger('click');
      await wrapper.find('.rewind-confirm-button').trigger('click');
      await flushPromises();
      expect(judgeRequests).to.deep.equal([{url: `api/judge/rewind?id=${judgeId}&password=a%26b&serverId=1`, body: {saveId: 11, cards: 'same', clocks: 'back'}}]);
      // The link back to the judge page carries the serverId too, or its first poll would claim an open seat.
      expect(window.location.href).to.equal(`judge?id=${judgeId}&password=a%26b&serverId=1`);
    });
  });
});
