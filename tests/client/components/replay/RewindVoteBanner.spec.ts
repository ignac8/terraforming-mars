import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, beforeEach, vi} from 'vitest';
import {globalConfig} from '../getLocalVue';
import RewindVoteBanner from '@/client/components/replay/RewindVoteBanner.vue';
import {fakePublicPlayerModel} from '../testHelpers';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {RewindVoteModel, RewindVotePoll} from '@/common/rewind/RewindVoteModel';
import {PlayerId} from '@/common/Types';

const blueId = 'p-blue-id' as PlayerId;
// A running game's model leaves the players' ids out.
const players = [
  fakePublicPlayerModel({color: 'blue', name: 'Blue', id: undefined}),
  fakePublicPlayerModel({color: 'red', name: 'Red', id: undefined}),
];

function openVote(overrides: Partial<RewindVoteModel> = {}): RewindVoteModel {
  return {
    voteId: 7,
    status: 'open',
    requester: 'red',
    saveId: 11,
    moveNumber: 3,
    generation: 2,
    cards: 'same',
    votes: [{color: 'blue', choice: 'pending'}],
    expiresInMs: 90_000,
    ...overrides,
  };
}

function poll(vote: RewindVoteModel | undefined, overrides: Partial<RewindVotePoll> = {}): RewindVotePoll {
  return {rewindCount: 0, vote, mayRequest: true, ...overrides};
}

describe('RewindVoteBanner', () => {
  let originalFetch: any;
  /** The requests sent, in order. */
  let requests: Array<{url: string, body?: unknown}>;
  /** What the next requests answer. The last one repeats. */
  let answers: Array<() => Promise<unknown>>;

  function answer(body: RewindVotePoll) {
    return () => Promise.resolve({ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('')});
  }

  function refuse(status: number, text: string) {
    return () => Promise.resolve({ok: false, status, json: () => Promise.reject(new Error('no json')), text: () => Promise.resolve(text)});
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('location', {href: 'http://localhost/player', search: ''});
    originalFetch = (global as any).fetch;
    requests = [];
    answers = [answer(poll(undefined))];
    (global as any).fetch = (url: string, init?: {body?: string}) => {
      requests.push({url, body: init?.body === undefined ? undefined : JSON.parse(init.body)});
      return (answers.length > 1 ? answers.shift()! : answers[0])();
    };
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mountBanner(props: Record<string, unknown> = {}) {
    return mount(RewindVoteBanner, {...globalConfig, props: {participantId: blueId, color: 'blue', password: '', players, pollMs: 1000, rewindCount: 0, ...props}});
  }

  async function ticks(ms: number) {
    await vi.advanceTimersByTimeAsync(ms);
    await flushPromises();
  }

  it('lets a pending voter answer the open vote', async () => {
    for (const choice of ['yes', 'no'] as const) {
      requests = [];
      answers = [answer(poll(openVote()))];
      const wrapper = mountBanner({password: '&password=pw'});
      await flushPromises();
      expect(requests[0].url).to.equal(`api/rewind/vote?id=${blueId}&password=pw`);
      expect(wrapper.find('.rewind-vote-cancel').exists()).is.false;
      await wrapper.find(`.rewind-vote-${choice}`).trigger('click');
      await flushPromises();
      expect(requests[1]).to.deep.equal({url: `api/rewind/vote?id=${blueId}&password=pw`, body: {action: choice, voteId: 7}});
      wrapper.unmount();
    }
  });

  it('lets the requester cancel, and offers them no vote', async () => {
    answers = [answer(poll(openVote({requester: 'red', votes: [{color: 'blue', choice: 'pending'}]})))];
    const wrapper = mountBanner({color: 'red'});
    await flushPromises();
    expect(wrapper.find('.rewind-vote-yes').exists()).is.false;
    expect(wrapper.find('.rewind-vote-no').exists()).is.false;
    await wrapper.find('.rewind-vote-cancel').trigger('click');
    await flushPromises();
    expect(requests[1].body).to.deep.equal({action: 'cancel', voteId: 7});
  });

  it('offers no vote to a player who already answered', async () => {
    answers = [answer(poll(openVote({votes: [{color: 'blue', choice: 'yes'}]})))];
    const wrapper = mountBanner();
    await flushPromises();
    expect(wrapper.find('.rewind-vote-yes').exists()).is.false;
    expect(wrapper.find('.rewind-vote-cancel').exists()).is.false;
  });

  it('shows what the vote route answered to a vote, and why one was refused', async () => {
    answers = [answer(poll(openVote())), answer(poll(openVote({votes: [{color: 'blue', choice: 'yes'}]})))];
    const answered = mountBanner();
    await flushPromises();
    await answered.find('.rewind-vote-yes').trigger('click');
    await flushPromises();
    expect(answered.find('.rewind-vote-yes').exists()).is.false;
    answered.unmount();

    answers = [answer(poll(openVote({voteId: 8}))), refuse(400, 'Bad request: This vote has ended.'), answer(poll(undefined))];
    const refused = mountBanner();
    await flushPromises();
    await refused.find('.rewind-vote-no').trigger('click');
    await flushPromises();
    expect(refused.find('.rewind-vote-error').text()).to.equal('This vote has ended.');
    // The table is read again, and the vote that has ended is gone.
    expect(refused.find('.rewind-vote-open').exists()).is.false;
    // The reason stays until the next poll.
    await ticks(1000);
    expect(refused.find('.rewind-vote-error').exists()).is.false;
  });

  it('shows in the fixed banner stack of the app, when the page has one', async () => {
    const stack = document.createElement('div');
    stack.id = 'rewind-banners';
    document.body.appendChild(stack);
    answers = [answer(poll(openVote()))];
    const wrapper = mountBanner();
    try {
      await flushPromises();
      expect(stack.querySelector('.rewind-vote-banner')).is.not.null;
      expect(wrapper.find('.rewind-vote-banner').exists()).is.false;
    } finally {
      wrapper.unmount();
      stack.remove();
    }
  });

  it('leaves a player name that is also a word, like Red, untranslated in another language', async () => {
    PreferencesManager.INSTANCE.set('lang', 'pl');
    (window as any)._translations = {
      '${0} asks to rewind to before move ${1} of generation ${2}.': '${0} prosi o cofnięcie gry do stanu sprzed ruchu ${1} w pokoleniu ${2}.',
      'Red': 'Czerwony',
    };
    answers = [answer(poll(openVote({requester: 'red'})))];
    try {
      const wrapper = mountBanner();
      await flushPromises();
      expect(wrapper.find('.rewind-vote-title').text()).equals('Red prosi o cofnięcie gry do stanu sprzed ruchu 3 w pokoleniu 2.');
    } finally {
      PreferencesManager.INSTANCE.set('lang', 'en');
      delete (window as any)._translations;
    }
  });

  it('asks the page to show the move of the vote', async () => {
    answers = [answer(poll(openVote()))];
    const wrapper = mountBanner();
    await flushPromises();
    await wrapper.find('.rewind-vote-show').trigger('click');
    expect(wrapper.emitted('show')).to.deep.equal([[11]]);
  });

  it('links to the replay instead of showing the move when it is given the replay address', async () => {
    answers = [answer(poll(openVote()))];
    const wrapper = mountBanner({replayUrl: 'replay?id=p-blue-id'});
    await flushPromises();
    expect(wrapper.find('.rewind-vote-show').exists()).is.false;
    expect(wrapper.find('a.rewind-vote-replay').attributes('href')).to.equal('replay?id=p-blue-id');
  });

  it('counts down from what the server says is left, and only while the vote is open', async () => {
    answers = [answer(poll(openVote({expiresInMs: 90_000})))];
    const wrapper = mountBanner({pollMs: 10_000});
    await flushPromises();
    expect(wrapper.find('.rewind-vote-countdown').text()).to.contain('1:30');
    await ticks(5000);
    expect(wrapper.find('.rewind-vote-countdown').text()).to.contain('1:25');

    answers = [answer(poll(openVote({status: 'expired', expiresInMs: 0})))];
    await ticks(5000);
    expect(wrapper.find('.rewind-vote-countdown').exists()).is.false;
  });

  it('runs the clock of the countdown only while a vote is open', async () => {
    answers = [answer(poll(undefined))];
    const wrapper = mountBanner({pollMs: 10_000});
    await flushPromises();
    const idle = vi.getTimerCount();
    answers = [answer(poll(openVote()))];
    await ticks(10_000);
    expect(vi.getTimerCount()).to.equal(idle + 1);
    answers = [answer(poll(openVote({status: 'expired', expiresInMs: 0})))];
    await ticks(10_000);
    expect(vi.getTimerCount()).to.equal(idle);
    wrapper.unmount();
  });

  it('says why a vote ended, and offers nothing to do about it', async () => {
    for (const status of ['rewinding', 'passed', 'declined', 'cancelled', 'expired', 'moved-on', 'froze', 'judge-rewound', 'failed'] as const) {
      answers = [answer(poll(openVote({status, expiresInMs: 0, reason: 'That moment can\'t be restored. Nothing was changed.'})))];
      const wrapper = mountBanner();
      await flushPromises();
      expect(wrapper.find('.rewind-vote-ended').exists(), status).is.true;
      expect(wrapper.find('.rewind-vote-yes').exists(), status).is.false;
      expect(wrapper.find('.rewind-vote-show').exists(), status).is.false;
      wrapper.unmount();
    }
  });

  it('says which judge action ended a vote', async () => {
    for (const [status, line] of [
      ['froze', 'The judge froze the game, so the rewind request ended.'],
      ['judge-rewound', 'The judge rewound the game, so the rewind request ended.'],
    ] as const) {
      answers = [answer(poll(openVote({status, expiresInMs: 0})))];
      const wrapper = mountBanner();
      await flushPromises();
      expect(wrapper.find('.rewind-vote-ended').text(), status).eq(line);
      wrapper.unmount();
    }
  });

  it('names who declined, and gives the reason a rewind failed', async () => {
    answers = [answer(poll(openVote({status: 'declined', expiresInMs: 0, votes: [{color: 'blue', choice: 'no'}]}), {mayRequest: false}))];
    const declined = mountBanner();
    await flushPromises();
    expect(declined.find('.rewind-vote-ended').text()).to.contain('Blue');
    declined.unmount();

    answers = [answer(poll(openVote({status: 'failed', expiresInMs: 0, reason: 'Bad request: Nothing was changed.'})))];
    const failed = mountBanner();
    await flushPromises();
    expect(failed.find('.rewind-vote-ended').text()).to.contain('Nothing was changed.');
    expect(failed.find('.rewind-vote-ended').text()).not.to.contain('Bad request');
  });

  it('tells the page why its player may not ask for a rewind right now', async () => {
    answers = [answer(poll(undefined, {mayRequest: false, blocked: 'frozen'})), answer(poll(undefined, {mayRequest: true}))];
    const wrapper = mountBanner();
    await flushPromises();
    await ticks(1000);
    expect(wrapper.emitted('requestBlock')).to.deep.equal([['frozen'], [undefined]]);
  });

  describe('after a rewind', () => {
    it('opens the game page again when the undo count of the table is not the page\'s', async () => {
      answers = [answer(poll(undefined)), answer(poll(undefined, {rewindCount: 1}))];
      mountBanner({password: '&password=pw', rewindCount: 0});
      await flushPromises();
      expect(window.location.href).to.equal('http://localhost/player');
      await ticks(1000);
      expect(window.location.href).to.equal(`player?id=${blueId}&password=pw`);
    });

    it('takes the first answer as what the page has when it is given no count', async () => {
      answers = [answer(poll(undefined, {rewindCount: 4})), answer(poll(undefined, {rewindCount: 4})), answer(poll(undefined, {rewindCount: 5}))];
      mountBanner({rewindCount: undefined});
      await flushPromises();
      await ticks(1000);
      expect(window.location.href).to.equal('http://localhost/player');
      await ticks(1000);
      expect(window.location.href).to.equal(`player?id=${blueId}`);
    });
  });

  describe('polling', () => {
    it('stops when the banner is gone', async () => {
      const wrapper = mountBanner();
      await flushPromises();
      await ticks(3000);
      expect(requests).to.have.length(4);
      wrapper.unmount();
      await ticks(5000);
      expect(requests).to.have.length(4);
    });

    /** An answer that stays on its way until `release` is called. */
    function held(body: RewindVotePoll): {request: () => Promise<unknown>, release: () => void} {
      let release: () => void = () => {};
      const request = () => new Promise((resolve) => {
        release = () => resolve({ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('')});
      });
      return {request, release: () => release()};
    }

    it('does not ask again when the banner went while its poll was on the way', async () => {
      const pending = held(poll(openVote()));
      answers = [pending.request];
      const wrapper = mountBanner();
      await ticks(0);
      wrapper.unmount();
      pending.release();
      await ticks(5000);
      expect(requests).to.have.length(1);
    });

    it('shows the newer of two answers when they come in the other order', async () => {
      const older = held(poll(openVote()));
      answers = [answer(poll(openVote())), older.request, answer(poll(openVote({votes: [{color: 'blue', choice: 'yes'}]})))];
      const wrapper = mountBanner();
      await ticks(1000);
      await wrapper.find('.rewind-vote-yes').trigger('click');
      await flushPromises();
      expect(wrapper.find('.rewind-vote-yes').exists()).is.false;
      older.release();
      await flushPromises();
      expect(wrapper.find('.rewind-vote-yes').exists()).is.false;
    });

    it('asks again only after the last answer came', async () => {
      const pending = held(poll(undefined));
      answers = [pending.request];
      mountBanner();
      await ticks(10_000);
      expect(requests).to.have.length(1);
      answers = [answer(poll(undefined))];
      pending.release();
      await ticks(1000);
      expect(requests).to.have.length(2);
    });

    it('keeps showing the vote when a poll fails, with no alert, and shows the next answer', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const alert = vi.fn();
      vi.stubGlobal('alert', alert);
      answers = [answer(poll(openVote())), refuse(500, 'down'), answer(poll(openVote({moveNumber: 9})))];
      const wrapper = mountBanner();
      await flushPromises();
      await ticks(1000);
      expect(wrapper.find('.rewind-vote-open').exists()).is.true;
      expect(alert.mock.calls).to.have.length(0);
      expect(wrapper.find('.rewind-vote-error').exists()).is.false;
      await ticks(1000);
      expect(wrapper.find('.rewind-vote-open').text()).to.contain('9');
    });
  });
});
