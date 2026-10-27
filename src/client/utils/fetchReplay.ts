import {paths} from '@/common/app/paths';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ReplayMovesModel, ReplayViewAs, ReplayViewModel, RewindCards} from '@/common/replay/ReplayModel';
import {RewindVotePoll} from '@/common/rewind/RewindVoteModel';
import {ParticipantId, PlayerId} from '@/common/Types';
import {translateText} from '@/client/directives/i18n';

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

async function checkOk(resp: Response): Promise<void> {
  if (!resp.ok) {
    // The server explains 400s and 404s in a text body.
    const text = await resp.text();
    throw new ReplayResponseError(text || `Replay request failed, response code ${resp.status}`, resp.status);
  }
}

async function readJson<T>(resp: Response): Promise<T> {
  await checkOk(resp);
  return resp.json();
}

// The solo player asks for the moves a rewind undid, which only the player of a solo or MarsBot game is given.
function undoneParam(undone: boolean): string {
  return undone ? '&undone=1' : '';
}

export async function fetchReplayMoves(id: ParticipantId, undone: boolean = false): Promise<ReplayMovesModel> {
  return readJson(await fetch(`${paths.API_REPLAY_MOVES}?id=${id}${undoneParam(undone)}`));
}

/** Rejects with an `AbortError` when a newer call replaced this one. `undone`: the save is one that a rewind undid. */
export async function fetchReplayView(id: ParticipantId, saveId: number, viewAs: ReplayViewAs, undone: boolean = false): Promise<ReplayViewModel> {
  viewAbortController?.abort();
  viewAbortController = new AbortController();
  const url = `${paths.API_REPLAY_VIEW}?id=${id}&save=${saveId}&as=${viewAs}${undoneParam(undone)}`;
  return readJson(await fetch(url, {signal: viewAbortController.signal}));
}

/** Rewinds the running game to before the move saved as `saveId`, and answers the player's view of the rewound game. */
export async function postRewind(id: PlayerId, saveId: number, cards: RewindCards): Promise<PlayerViewModel> {
  const resp = await fetch(`${paths.API_REWIND}?id=${id}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({saveId, cards}),
  });
  return readJson(resp);
}

/** What a player sends to the vote route: ask for a rewind, or answer the open vote. */
export type VoteBody =
  | {action: 'request', saveId: number, cards: RewindCards}
  | {action: 'yes' | 'no' | 'cancel', voteId: number};

/** The open rewind vote of the table, if any, and whether this player may still ask for one. */
export async function fetchVote(id: PlayerId): Promise<RewindVotePoll> {
  return readJson(await fetch(`${paths.API_REWIND_VOTE}?id=${id}`));
}

/** Asks for a rewind or answers the open vote, and answers what `fetchVote` would. */
export async function postVote(id: PlayerId, body: VoteBody): Promise<RewindVotePoll> {
  const resp = await fetch(`${paths.API_REWIND_VOTE}?id=${id}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  return readJson(resp);
}

// The server writes a refusal as its status text and the reason, as in `Bad request: <reason>`.
const STATUS_TEXT = /^(Bad request|Not found): /;

/** The reason the server gave for a refusal, in the language of the player. */
export function translateRefusal(text: string): string {
  return translateText(text.replace(STATUS_TEXT, ''));
}
