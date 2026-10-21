import {expect} from 'chai';
import {afterEach, beforeEach} from 'vitest';
import {fetchReplayMoves, fetchReplayView} from '@/client/utils/fetchReplay';

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
});
