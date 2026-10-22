import {expect} from 'chai';
import {afterEach, beforeEach} from 'vitest';
import {fetchReplayMoves, fetchReplayView, postRewind, translateRefusal} from '@/client/utils/fetchReplay';
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

  for (const id of ['s-spectator-id', 'p-player-id'] as const) {
    it(`does not send a password for ${id}`, async () => {
      window.history.replaceState({}, '', `/replay?id=${id}&password=secret`);

      await fetchReplayMoves(id);
      await fetchReplayView(id, 3, 'all');

      expect(urls).deep.eq([
        `api/replay/moves?id=${id}`,
        `api/replay/view?id=${id}&save=3&as=all`,
      ]);
    });
  }

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
