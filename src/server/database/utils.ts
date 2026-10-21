/**
 * Adds `days` days to `date`. `days can be negative.
 * @param date a valid date
 * @param days a number of days
 * @returns date + days (in days)
 */
export function addDays(date: Date, days: number) {
  const ms = Math.round(date.getTime());
  const daysInMs = days * 86400 * 1000;
  return new Date(ms + daysInMs);
}

export function dateToSeconds(date: Date) {
  return Math.round(date.getTime() / 1000);
}

/**
 * How long, after a game ends, to keep every save. Replay needs them all. Afterwards only the first and last remain.
 */
export const DEFAULT_COMPRESS_COMPLETED_GAMES_DAYS = '14';

export function stringToNumber(s: string | undefined, defaultValue: number): number {
  if (s === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(s);
  return Number.isInteger(parsed) ? parsed : defaultValue;
}

export function stringToBoolean(s: string | undefined, defaultValue: boolean): boolean {
  if (s === undefined) {
    return defaultValue;
  }
  if (s === 'true') {
    return true;
  }
  if (s === 'false') {
    return false;
  }
  const parsed = parseInt(s);
  return Number.isInteger(parsed) ? parsed > 0 : defaultValue;
}

export function daysAgoToSeconds(dayString: string | undefined, defaultValue: number): number {
  const days = stringToNumber(dayString, defaultValue);
  const date = addDays(new Date(), -days);
  return dateToSeconds(date);
}

/**
 * The time before which completed games get compressed. A negative number of days would put the
 * cutoff in the future and compress every completed game, so it counts as invalid.
 */
export function compressCutoffSeconds(dayString: string | undefined): number {
  const defaultDays = Number(DEFAULT_COMPRESS_COMPLETED_GAMES_DAYS);
  return daysAgoToSeconds(stringToNumber(dayString, defaultDays) < 0 ? undefined : dayString, defaultDays);
}
