import {expect} from 'chai';
import {afterEach, vi} from 'vitest';
import {fetchLogs} from '@/client/utils/fetchLogs';
import {ViewModel} from '@/common/models/PlayerModel';

describe('fetchLogs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  // Runs fetchLogs for a view at `search` and returns the URL it requested.
  async function requestedUrl(search: string, view: Partial<ViewModel>): Promise<string> {
    window.history.replaceState({}, '', '/judge' + search);
    const fetchStub = vi.fn(async () => ({ok: true, status: 200, json: async () => []}) as unknown as Response);
    vi.stubGlobal('fetch', fetchStub);
    await fetchLogs({id: 'j1', ...view} as ViewModel, 3);
    return (fetchStub.mock.calls[0] as unknown as Array<string>)[0];
  }

  it('forwards the serverId of the address bar', async () => {
    const url = await requestedUrl('?id=j1&serverId=a%26b', {});

    expect(new URL(url, 'http://x').searchParams.get('serverId')).eq('a&b');
  });

  it('sends no serverId when the address bar has none', async () => {
    const url = await requestedUrl('?id=j1', {});

    expect(url).does.not.include('serverId');
  });

  it('still sends the seat password', async () => {
    const url = await requestedUrl('?id=j1&serverId=1', {password: 'abc'} as any);

    expect(new URL(url, 'http://x').searchParams.get('password')).eq('abc');
  });
});
