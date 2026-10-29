import {flushPromises, mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, beforeEach, vi} from 'vitest';
import {globalConfig} from '../getLocalVue';
import ReplayScreen from '@/client/components/replay/ReplayScreen.vue';
import ReplayPanel from '@/client/components/replay/ReplayPanel.vue';
import ReplayHands from '@/client/components/replay/ReplayHands.vue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import SpectatorHome from '@/client/components/SpectatorHome.vue';
import {fakeGameModel, fakeGameOptionsModel, fakePlayerViewModel, fakePublicPlayerModel, fakeSpectatorModel} from '../testHelpers';
import {ReplayMove, ReplayMovesModel, ReplayViewModel} from '@/common/replay/ReplayModel';
import {PlayerId, SpectatorId} from '@/common/Types';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {PendingChoiceModel} from '@/common/models/PendingChoiceModel';
import JudgePendingChoice from '@/client/components/judge/JudgePendingChoice.vue';
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

  it('shows what the player viewed as was choosing among at a past move', async () => {
    pastChoice = {title: 'Select card(s) to buy', cards: [{name: CardName.COMET}, {name: CardName.ANTS}]};
    const wrapper = mountScreen();
    await flushPromises();
    const choice = () => wrapper.findComponent(JudgePendingChoice);
    expect(choice().exists()).is.false;

    wrapper.findComponent(ReplayPanel).vm.$emit('update:viewAs', 'blue');
    await flushPromises();
    expect(wrapper.findComponent(PlayerHome).props('playerView').thisPlayer.tableau.map((c: {name: CardName}) => c.name)).to.deep.equal([CardName.ECOLINE]);
    expect(choice().props('choice')).to.deep.equal(pastChoice);
    expect(choice().props('shown')).to.deep.equal([CardName.ECOLINE]);

    wrapper.findComponent(ReplayPanel).vm.$emit('update:viewAs', 'all');
    await flushPromises();
    expect(choice().exists()).is.false;
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

    describe('the undone moves', () => {
      const withUndone: ReplayMovesModel = {status: 'available', ...rewindable, moves: [
        {saveId: 10, messages: played},
        {saveId: 11, messages: played, undone: true},
        {saveId: 12, messages: played},
      ]};
      const withoutUndone: ReplayMovesModel = {status: 'available', ...rewindable, moves: [{saveId: 10, messages: played}, {saveId: 12, messages: played}]};
      const movesCalls = () => calls.filter((url) => url.startsWith('api/replay/moves'));
      const switchOf = (wrapper: ReturnType<typeof mountRewindable>) => wrapper.find('.replay-show-undone input');
      const panel = (wrapper: ReturnType<typeof mountRewindable>) => wrapper.findComponent(ReplayPanel);

      function mountWithControls() {
        return shallowMount(ReplayScreen, {
          ...globalConfig,
          global: {...globalConfig.global, stubs: {ReplayPanel: false, RewindControls: false}},
          props: {participantId: playerId},
        });
      }

      it('are off when the page loads, and read again with the parameter when the switch is turned on and off', async () => {
        movesAnswer = withoutUndone;
        const wrapper = mountRewindable();
        await flushPromises();
        expect(movesCalls()).to.deep.equal([`api/replay/moves?id=${playerId}`]);

        movesAnswer = withUndone;
        await switchOf(wrapper).setValue(true);
        await flushPromises();
        expect(movesCalls()[1]).to.equal(`api/replay/moves?id=${playerId}&undone=1`);
        expect(wrapper.findAll('.replay-move-undone')).to.have.length(1);

        movesAnswer = withoutUndone;
        await switchOf(wrapper).setValue(false);
        await flushPromises();
        expect(movesCalls()[2]).to.equal(`api/replay/moves?id=${playerId}`);
        expect(wrapper.findAll('.replay-move-undone')).to.have.length(0);
      });

      it('are shown with the parameter, and rewound to through the rewind route', async () => {
        movesAnswer = withUndone;
        const wrapper = mountWithControls();
        await flushPromises();
        await switchOf(wrapper).setValue(true);
        await flushPromises();

        for (const [index, saveId, undone] of [[2, 12, false], [1, 11, true]] as const) {
          panel(wrapper).vm.$emit('select', index);
          await flushPromises();
          expect(calls[calls.length - 1], String(index)).to.equal(`api/replay/view?id=${playerId}&save=${saveId}&as=all${undone ? '&undone=1' : ''}`);
          expect(wrapper.find('.rewind-controls').exists(), String(index)).is.true;
        }
        await wrapper.find('.rewind-start').trigger('click');
        expect(wrapper.find('.rewind-confirm-undone').exists()).is.true;
        await wrapper.find('.rewind-confirm-button').trigger('click');
        await flushPromises();
        expect(rewinds).to.deep.equal([{url: `api/rewind?id=${playerId}`, body: {saveId: 11, cards: 'same'}}]);
      });

      it('stay on the move that is shown when the list changes, and move to the nearest move when it is gone', async () => {
        movesAnswer = withUndone;
        const wrapper = mountRewindable();
        await flushPromises();
        await switchOf(wrapper).setValue(true);
        await flushPromises();
        panel(wrapper).vm.$emit('select', 2);
        await flushPromises();

        // Move 12 is index 1 once the undone move is out of the list.
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
        expect(panel(wrapper).props('index')).equals(0);
        expect(calls[calls.length - 1]).to.equal(`api/replay/view?id=${playerId}&save=10&as=all`);
      });

      it('are offered to the solo player, and to no one else', async () => {
        for (const [participantId, canRewind, expected] of [[playerId, true, true], [playerId, false, false], [id, true, false]] as const) {
          movesAnswer = {status: 'available', ...rewindable, canRewind, moves: [{saveId: 10, messages: played}]};
          const wrapper = shallowMount(ReplayScreen, {...globalConfig, props: {participantId}});
          await flushPromises();
          expect(wrapper.findComponent(ReplayPanel).props('canShowUndone'), `${participantId} ${canRewind}`).equals(expected);
          wrapper.unmount();
        }
      });
    });

    it('rewinds a solo game from the live game page by the id of the player alone', async () => {
      movesAnswer = {status: 'available', finished: false, canRewind: true, canVoteRewind: false, defaultViewAs: 'blue', moves: [{saveId: 10, messages: played}, {saveId: 11, messages: played}]};
      const wrapper = shallowMount(ReplayScreen, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {ReplayPanel: false}},
        props: {participantId: playerId, liveView: playedView()},
      });
      await wrapper.find('.replay-collapse').trigger('click');
      await flushPromises();
      wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
      await flushPromises();
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'same');
      await flushPromises();
      expect(rewinds).to.deep.equal([{url: `api/rewind?id=${playerId}`, body: {saveId: 11, cards: 'same'}}]);
      expect(window.location.href).to.equal(`player?id=${playerId}`);
    });
  });

  describe('on the replay URL of a table that votes on a rewind', () => {
    // The replay views carry no player ids, as a running game's model carries none.
    const blue = () => fakePublicPlayerModel({color: 'blue', id: undefined, name: 'blue'});
    const red = () => fakePublicPlayerModel({color: 'red', id: undefined, name: 'red'});

    // Only a running game is voted on: a finished one answers that nobody can.
    function voteMoves(finished: boolean, canVoteRewind = !finished): ReplayMovesModel {
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

    it('shows the vote controls and the banner to a player of a running game who may vote, and to no one else', async () => {
      for (const [finished, canVoteRewind] of [[false, true], [false, false], [true, false]] as const) {
        movesAnswer = voteMoves(finished, canVoteRewind);
        const wrapper = mountReplay();
        await flushPromises();
        wrapper.findComponent(ReplayPanel).vm.$emit('select', 1);
        await flushPromises();
        const label = `finished ${finished}, may vote ${canVoteRewind}`;
        expect(wrapper.findComponent(RewindVoteBanner).exists(), label).equals(canVoteRewind);
        expect(wrapper.findComponent(RewindControls).exists(), label).equals(canVoteRewind);
        if (canVoteRewind) {
          expect(wrapper.findComponent(RewindControls).props('mode')).equals('vote');
        }
        wrapper.unmount();
      }
    });

    it('offers the request on the player\'s own moves only', async () => {
      for (const [index, offered] of [[0, true], [1, false]] as const) {
        movesAnswer = {
          status: 'available', finished: false, canRewind: false, canVoteRewind: true, viewerColor: 'blue', defaultViewAs: 'blue',
          moves: [{saveId: 10, messages: played, movers: ['blue']}, {saveId: 11, messages: played, movers: ['red']}],
        };
        const wrapper = mountReplay();
        await flushPromises();
        wrapper.findComponent(ReplayPanel).vm.$emit('select', index);
        await flushPromises();
        expect(wrapper.findComponent(RewindControls).exists(), String(index)).equals(offered);
        wrapper.unmount();
      }
    });

    it('knows the seat of the player by colour, so they can answer', async () => {
      movesAnswer = voteMoves(false);
      const vote = {voteId: 7, status: 'open', requester: 'red', saveId: 11, moveNumber: 2, generation: 1, cards: 'same', votes: [{color: 'blue', choice: 'pending'}], expiresInMs: 60_000};
      voteAnswer = () => respond({rewindCount: 0, vote});
      const wrapper = mountReplay(true);
      await flushPromises();
      expect(wrapper.find('.rewind-vote-yes').exists()).is.true;
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

    it('lets the solo player of a running game pick no view but their own, and of a finished game any', async () => {
      for (const [participantId, finished, shown] of [
        [playerId, true, true],
        [playerId, false, false],
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
      movesAnswer = voteMoves(false);
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

    it('asks for the history by the id of the player alone', async () => {
      const wrapper = mountLive();
      expand(wrapper);
      await flushPromises();
      panel(wrapper).vm.$emit('select', 1);
      await flushPromises();
      expect(calls).to.deep.equal([
        `api/replay/moves?id=${playerId}`,
        `api/replay/view?id=${playerId}&save=11&as=blue`,
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

      it('gives the banner the players and the rewind count of the page', async () => {
        const wrapper = mountVote(false, {...voteView(), game: fakeGameModel({rewindCount: 3, gameOptions: fakeGameOptionsModel({undoOption: true})})});
        const banner = wrapper.findComponent(RewindVoteBanner);
        expect(banner.props('participantId')).to.equal(playerId);
        expect(banner.props('rewindCount')).to.equal(3);
        expect(banner.props('players')).has.length(2);
      });

      it('asks the others to rewind to the selected move, as a request for a vote', async () => {
        const wrapper = mountVote(false);
        await open(wrapper);
        await flushPromises();
        panel(wrapper).vm.$emit('select', 1);
        await flushPromises();
        const controls = wrapper.findComponent(RewindControls);
        expect(controls.props('mode')).to.equal('vote');
        controls.vm.$emit('request', 'shuffle');
        await flushPromises();
        expect(votes).to.deep.equal([{url: `api/rewind/vote?id=${playerId}`, body: {action: 'request', saveId: 11, cards: 'shuffle'}}]);
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

      it('goes back to the live game and reads the moves again when the table was rewound under it, and not when only the undo count changed', async () => {
        for (const rewound of [true, false]) {
          const wrapper = mountVote(false);
          await open(wrapper);
          await flushPromises();
          panel(wrapper).vm.$emit('select', 1);
          await flushPromises();
          expect(panel(wrapper).props('index')).to.equal(1);
          const read = moveRequests().length;
          const next = voteView();
          // The undo count changes without a rewind, too.
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
});
