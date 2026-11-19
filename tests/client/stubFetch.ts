import {vi} from 'vitest';

type FetchHandler = (...args: never[]) => unknown;

/** Stubs the global `fetch` with `handler` and returns it, so a `vi.fn` can still be asserted on. */
export function stubFetch<T extends FetchHandler>(handler: T): T {
  vi.stubGlobal('fetch', handler);
  return handler;
}
