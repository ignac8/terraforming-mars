import {paths} from '@/common/app/paths';
import {ReplayMovesModel, ReplayViewAs, ReplayViewModel} from '@/common/replay/ReplayModel';
import {isJudgeId, ParticipantId} from '@/common/Types';
import {passwordQuery} from '@/client/utils/playerPassword';

// Replaying steps through views quickly, so a new view request cancels the one still in flight.
// Kept apart from fetchLogs' controller so the two never cancel each other.
let viewAbortController: AbortController | undefined;

/** A replay request the server answered with an error status. */
export class ReplayResponseError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ReplayResponseError';
  }
}

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    // The server explains 400s and 404s in a text body.
    const text = await resp.text();
    throw new ReplayResponseError(text || `Replay request failed, response code ${resp.status}`, resp.status);
  }
  return resp.json();
}

// A judge link with a claimed seat needs its password, sent as a query parameter like every other
// judge request. The replay page has no model to read it from, so it comes from the address bar,
// where the judge page's link puts it. Players and spectators need none.
function judgePasswordParam(id: ParticipantId): string {
  if (!isJudgeId(id)) {
    return '';
  }
  return passwordQuery(new URLSearchParams(window.location.search).get('password'));
}

export async function fetchReplayMoves(id: ParticipantId): Promise<ReplayMovesModel> {
  return readJson(await fetch(`${paths.API_REPLAY_MOVES}?id=${id}${judgePasswordParam(id)}`));
}

/** Rejects with an `AbortError` when a newer call replaced this one. */
export async function fetchReplayView(id: ParticipantId, saveId: number, viewAs: ReplayViewAs): Promise<ReplayViewModel> {
  viewAbortController?.abort();
  viewAbortController = new AbortController();
  const url = `${paths.API_REPLAY_VIEW}?id=${id}&save=${saveId}&as=${viewAs}${judgePasswordParam(id)}`;
  return readJson(await fetch(url, {signal: viewAbortController.signal}));
}
