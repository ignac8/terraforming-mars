import {expect} from 'chai';
import {afterEach, beforeEach} from 'vitest';
import {fetchReplayMoves, fetchReplayView, fetchVote, postRewind, postVote, ReplayResponseError, translateRefusal} from '@/client/utils/fetchReplay';
import {PreferencesManager} from '@/client/utils/PreferencesManager';

describe('fetchReplay', () => {
  let originalFetch: any;
  let posts: Array<{url: string, init: any}>;

  beforeEach(() => {
    originalFetch = (global as any).fetch;
    posts = [];
    (global as any).fetch = async (url: string, init: any) => {
      posts.push({url, init});
      return {ok: true, status: 200, json: () => Promise.resolve({})};
    };
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    window.history.replaceState({}, '', '/');
    PreferencesManager.INSTANCE.set('lang', 'en');
    delete (window as any)._translations;
  });

  const urls = () => posts.map(({url}) => url);

  it('asks for the moves and a view of a participant by id alone', async () => {
    await fetchReplayMoves('p-player-id');
    await fetchReplayView('p-player-id', 3, 'blue');
    await fetchReplayMoves('s-spectator-id');
    await fetchReplayView('s-spectator-id', 3, 'all');

    expect(urls()).deep.eq([
      'api/replay/moves?id=p-player-id',
      'api/replay/view?id=p-player-id&save=3&as=blue',
      'api/replay/moves?id=s-spectator-id',
      'api/replay/view?id=s-spectator-id&save=3&as=all',
    ]);
  });

  it('aborts the view request that a newer one replaces', async () => {
    const signals: Array<AbortSignal> = [];
    (global as any).fetch = async (_url: string, init: any) => {
      signals.push(init.signal);
      return {ok: true, status: 200, json: () => Promise.resolve({})};
    };

    await fetchReplayView('p-player-id', 3, 'blue');
    await fetchReplayView('p-player-id', 4, 'blue');

    expect(signals.map((signal) => signal.aborted)).deep.eq([true, false]);
  });

  it('throws what the server refused with, and its status', async () => {
    (global as any).fetch = async () => ({ok: false, status: 400, text: () => Promise.resolve('Bad request: game not finished')});

    for (const call of [
      () => fetchReplayMoves('p-player-id'),
      () => fetchReplayView('p-player-id', 3, 'blue'),
      () => postRewind('p-player-id', 3, 'same'),
      () => fetchVote('p-player-id'),
      () => postVote('p-player-id', {action: 'yes', voteId: 7}),
    ]) {
      const error = await call().then(() => undefined, (err: unknown) => err as ReplayResponseError);
      expect(error).instanceOf(ReplayResponseError);
      expect(error!.status).eq(400);
      expect(error!.message).eq('Bad request: game not finished');
    }
  });

  it('says so when the server refused without a reason', async () => {
    (global as any).fetch = async () => ({ok: false, status: 500, text: () => Promise.resolve('')});

    const error = await fetchReplayMoves('p-player-id').then(() => undefined, (err: unknown) => err as ReplayResponseError);

    expect(error!.status).eq(500);
    expect(error!.message).eq('Replay request failed, response code 500');
  });

  describe('postRewind', () => {
    it('posts the move and the cards to the rewind route of the player', async () => {
      await postRewind('p-player-id', 3, 'shuffle');

      expect(posts).has.length(1);
      expect(posts[0].url).eq('api/rewind?id=p-player-id');
      expect(posts[0].init.method).eq('POST');
      expect(JSON.parse(posts[0].init.body)).deep.eq({saveId: 3, cards: 'shuffle'});
    });
  });

  describe('the vote routes', () => {
    it('poll the vote of the table by the id of the player', async () => {
      await fetchVote('p-player-id');

      expect(urls()).deep.eq(['api/rewind/vote?id=p-player-id']);
    });

    it('post a request for a rewind and an answer to the open vote', async () => {
      await postVote('p-player-id', {action: 'request', saveId: 3, cards: 'same'});
      await postVote('p-player-id', {action: 'no', voteId: 7});

      expect(posts.map(({url, init}) => [url, init.method, JSON.parse(init.body)])).deep.eq([
        ['api/rewind/vote?id=p-player-id', 'POST', {action: 'request', saveId: 3, cards: 'same'}],
        ['api/rewind/vote?id=p-player-id', 'POST', {action: 'no', voteId: 7}],
      ]);
    });
  });

  describe('translateRefusal', () => {
    beforeEach(() => {
      PreferencesManager.INSTANCE.set('lang', 'pl');
      (window as any)._translations = {'A rewind is already running.': 'Cofanie gry już trwa.'};
    });

    it('translates the reason the server gives, without the status text before it', () => {
      expect(translateRefusal('Bad request: A rewind is already running.')).eq('Cofanie gry już trwa.');
      expect(translateRefusal('Not found: A rewind is already running.')).eq('Cofanie gry już trwa.');
      expect(translateRefusal('A rewind is already running.')).eq('Cofanie gry już trwa.');
    });

    it('leaves a text it has no translation for', () => {
      expect(translateRefusal('Bad request: something else')).eq('something else');
    });
  });
});
