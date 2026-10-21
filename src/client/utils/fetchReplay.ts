import {paths} from '@/common/app/paths';
import {ReplayMovesModel, ReplayViewAs, ReplayViewModel} from '@/common/replay/ReplayModel';
import {ParticipantId} from '@/common/Types';

// Replaying steps through views quickly, so a new view request cancels the one still in flight.
// Kept apart from fetchLogs' controller so the two never cancel each other.
let viewAbortController: AbortController | undefined;

async function readJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    // The server explains 400s and 404s in a text body.
    const text = await resp.text();
    throw new Error(text || `Replay request failed, response code ${resp.status}`);
  }
  return resp.json();
}

export async function fetchReplayMoves(id: ParticipantId): Promise<ReplayMovesModel> {
  return readJson(await fetch(`${paths.API_REPLAY_MOVES}?id=${id}`));
}

/** Rejects with an `AbortError` when a newer call replaced this one. */
export async function fetchReplayView(id: ParticipantId, saveId: number, viewAs: ReplayViewAs): Promise<ReplayViewModel> {
  viewAbortController?.abort();
  viewAbortController = new AbortController();
  const url = `${paths.API_REPLAY_VIEW}?id=${id}&save=${saveId}&as=${viewAs}`;
  return readJson(await fetch(url, {signal: viewAbortController.signal}));
}
