import {paths} from '@/common/app/paths';
import {LogMessage} from '@/common/logs/LogMessage';
import {ViewModel} from '@/common/models/PlayerModel';
import {passwordParam} from '@/client/utils/playerPassword';

let abortController: AbortController | undefined;

export async function fetchLogs(view: ViewModel, generation: number): Promise<Array<LogMessage> | undefined> {
  // Aborts any pending request for a previous generation before starting the new one.
  // If the past call is complete, .abort() does nothing.
  abortController?.abort();
  abortController = new AbortController();

  // A serverId visit leaves an open seat unclaimed, so the log request carries the serverId too.
  const serverId = new URLSearchParams(window.location.search).get('serverId');
  const serverIdParam = serverId === null ? '' : '&serverId=' + encodeURIComponent(serverId);
  const url = `${paths.API_GAME_LOGS}?id=${view.id}&generation=${generation}${passwordParam(view)}${serverIdParam}`;

  try {
    const resp = await fetch(url, {signal: abortController.signal});
    if (!resp.ok) {
      console.error(`error updating messages, response code ${resp.status}`);
      return undefined;
    }
    return await resp.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // ignore aborted requests
      return undefined;
    }
    console.error('error updating messages, unable to reach server');
    return undefined;
  }
}
