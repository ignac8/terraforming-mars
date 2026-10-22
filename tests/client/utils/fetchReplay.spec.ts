import {expect} from 'chai';
import {afterEach, beforeEach} from 'vitest';
import {fetchReplayMoves, fetchReplayView, postJudgeFreeze, postJudgeRewind, postRewind, ReplayResponseError, translateRefusal} from '@/client/utils/fetchReplay';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {fakePlayerViewModel} from '../components/testHelpers';

describe('fetchReplay', () => {
  let originalFetch: any;
  let urls: Array<string>;

  beforeEach(() => {
    originalFetch = (global as any).fetch;
    urls = [];
    (global as any).fetch = async (url: string) => {
      urls.push(url);
      return {ok: true, status: 200, json: () => Promise.resolve({})};
    };
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    window.history.replaceState({}, '', '/');
    PreferencesManager.INSTANCE.set('lang', 'en');
    delete (window as any)._translations;
  });

  it('sends the judge password from the address bar, the way the judge page does', async () => {
    window.history.replaceState({}, '', '/replay?id=j-judge-id&password=a%26b');

    await fetchReplayMoves('j-judge-id');
    await fetchReplayView('j-judge-id', 3, 'all');

    expect(urls).deep.eq([
      'api/replay/moves?id=j-judge-id&password=a%26b',
      'api/replay/view?id=j-judge-id&save=3&as=all&password=a%26b',
    ]);
  });

  it('sends nothing extra when a judge link has no password', async () => {
    window.history.replaceState({}, '', '/replay?id=j-judge-id');

    await fetchReplayMoves('j-judge-id');

    expect(urls).deep.eq(['api/replay/moves?id=j-judge-id']);
  });

  it('does not send a password for a spectator', async () => {
    window.history.replaceState({}, '', '/replay?id=s-spectator-id&password=secret');

    await fetchReplayMoves('s-spectator-id', '&password=secret');
    await fetchReplayView('s-spectator-id', 3, 'all', '&password=secret');

    expect(urls).deep.eq([
      'api/replay/moves?id=s-spectator-id',
      'api/replay/view?id=s-spectator-id&save=3&as=all',
    ]);
  });

  it('sends the password of a judge page once', async () => {
    window.history.replaceState({}, '', '/replay?id=j-judge-id&password=from-address');

    await fetchReplayMoves('j-judge-id', '&password=a%26b');
    await fetchReplayView('j-judge-id', 3, 'all', '&password=a%26b');

    expect(urls).deep.eq([
      'api/replay/moves?id=j-judge-id&password=a%26b',
      'api/replay/view?id=j-judge-id&save=3&as=all&password=a%26b',
    ]);
  });

  it('sends a player the seat password it was given, or else the one in the address bar', async () => {
    window.history.replaceState({}, '', '/replay?id=p-player-id&password=from-address');

    await fetchReplayMoves('p-player-id', '&password=a%26b');
    await fetchReplayView('p-player-id', 3, 'blue', '&password=a%26b');
    await fetchReplayMoves('p-player-id');
    await fetchReplayView('p-player-id', 3, 'blue');

    expect(urls).deep.eq([
      'api/replay/moves?id=p-player-id&password=a%26b',
      'api/replay/view?id=p-player-id&save=3&as=blue&password=a%26b',
      'api/replay/moves?id=p-player-id&password=from-address',
      'api/replay/view?id=p-player-id&save=3&as=blue&password=from-address',
    ]);
  });

  describe('postRewind', () => {
    const playerId = 'p-player-id';

    it('sends the seat password of the live view', async () => {
      window.history.replaceState({}, '', `/player?id=${playerId}&password=from-address`);

      await postRewind(playerId, 3, 'same', fakePlayerViewModel({password: 'a&b'}));

      expect(urls).deep.eq([`api/rewind?id=${playerId}&password=a%26b`]);
    });

    it('sends the password of the address bar on the replay page', async () => {
      window.history.replaceState({}, '', `/replay?id=${playerId}&password=a%26b`);

      await postRewind(playerId, 3, 'same');

      expect(urls).deep.eq([`api/rewind?id=${playerId}&password=a%26b`]);
    });

    it('sends nothing extra when the game has no password', async () => {
      await postRewind(playerId, 3, 'same');

      expect(urls).deep.eq([`api/rewind?id=${playerId}`]);
    });
  });

  describe('the judge routes', () => {
    const judgeId = 'j-judge-id';
    let posts: Array<{url: string, init: any}>;

    beforeEach(() => {
      posts = [];
      // The routes answer the judge's model, which these calls leave to the next poll.
      (global as any).fetch = async (url: string, init: any) => {
        posts.push({url, init});
        return {ok: true, status: 200, json: () => Promise.reject(new Error('the body is not read'))};
      };
    });

    it('post the rewind and the freeze with the password of the address bar', async () => {
      window.history.replaceState({}, '', `/judge?id=${judgeId}&password=a%26b`);

      await postJudgeRewind(judgeId, 3, 'shuffle', 'keep');
      await postJudgeFreeze(judgeId, true);

      expect(posts.map(({url, init}) => [url, init.method, JSON.parse(init.body)])).deep.eq([
        [`api/judge/rewind?id=${judgeId}&password=a%26b`, 'POST', {saveId: 3, cards: 'shuffle', clocks: 'keep'}],
        [`api/judge/freeze?id=${judgeId}&password=a%26b`, 'POST', {frozen: true}],
      ]);
    });

    it('throw what the server refused with', async () => {
      (global as any).fetch = async () => ({ok: false, status: 400, text: () => Promise.resolve('Bad request: The game is not frozen.')});

      for (const call of [() => postJudgeRewind(judgeId, 3, 'same', 'back'), () => postJudgeFreeze(judgeId, false)]) {
        const error = await call().then(() => undefined, (err) => err);
        expect(error).instanceOf(ReplayResponseError);
        expect(error.status).eq(400);
        expect(error.message).eq('Bad request: The game is not frozen.');
      }
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
