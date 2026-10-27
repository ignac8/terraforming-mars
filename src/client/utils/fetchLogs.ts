import {paths} from '@/common/app/paths';
import {LogMessage} from '@/common/logs/LogMessage';
import {ViewModel} from '@/common/models/PlayerModel';
import {passwordParam} from '@/client/utils/playerPassword';
import {localColors} from '@/client/utils/localColors';

let abortController: AbortController | undefined;

/** `undone`: the judge's log with the lines that rewinds hid, each marked. */
export async function fetchLogs(view: ViewModel, generation: number, undone: boolean = false): Promise<Array<LogMessage> | undefined> {
  // Aborts any pending request for a previous generation before starting the new one.
  // If the past call is complete, .abort() does nothing.
  abortController?.abort();
  abortController = new AbortController();

  // A serverId visit leaves an open seat unclaimed, so the log request carries the serverId too.
  const serverId = new URLSearchParams(window.location.search).get('serverId');
  const serverIdParam = serverId === null ? '' : '&serverId=' + encodeURIComponent(serverId);
  const url = `${paths.API_GAME_LOGS}?id=${view.id}&generation=${generation}${passwordParam(view)}${serverIdParam}${undone ? '&undone=1' : ''}`;

  try {
    const resp = await fetch(url, {signal: abortController.signal});
    if (!resp.ok) {
      console.error(`error updating messages, response code ${resp.status}`);
      return undefined;
    }
    return localColors(await resp.json());
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // ignore aborted requests
      return undefined;
    }
    console.error('error updating messages, unable to reach server');
    return undefined;
  }
}
