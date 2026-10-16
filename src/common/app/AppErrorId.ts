export const INVALID_RUN_ID = '#invalid-run-id' as const;
/** The submitted response was built for a prompt the server is no longer showing. */
export const STALE_VIEW = '#stale-view' as const;
export const RESPONDING_TOO_QUICKLY = '#responding-too-quickly' as const;
export type AppErrorId = typeof INVALID_RUN_ID | typeof STALE_VIEW | typeof RESPONDING_TOO_QUICKLY;

export type AppErrorResponse = {
  id: AppErrorId | undefined;
  message: string;
}
