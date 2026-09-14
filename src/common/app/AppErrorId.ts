export const INVALID_RUN_ID = '#invalid-run-id' as const;
/** The submitted response was built for a prompt the server is no longer showing. */
export const STALE_VIEW = '#stale-view' as const;
export type AppErrorId = '#invalid-run-id' | '#stale-view';

export type AppErrorResponse = {
  id: AppErrorId | undefined;
  message: string;
}
