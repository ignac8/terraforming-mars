import {paths} from '@/common/app/paths';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ReplayMovesModel, ReplayViewAs, ReplayViewModel, RewindCards} from '@/common/replay/ReplayModel';
import {RewindVotePoll} from '@/common/rewind/RewindVoteModel';
import {isJudgeId, isPlayerId, ParticipantId, PlayerId} from '@/common/Types';
import {translateText} from '@/client/directives/i18n';
import {passwordParam, passwordQuery} from '@/client/utils/playerPassword';

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

// The replay page has no model to read a password from, so it comes from the address bar, where
// the judge page's link and the player's own link put it.
function addressBarPasswordParam(): string {
  return passwordQuery(new URLSearchParams(window.location.search).get('password'));
}

// A claimed seat needs its password, sent as a query parameter like every other request of the
// seat. The live game page passes the fragment `passwordParam` makes from its model. The replay page
// has none to pass, so a player or judge id reads the address bar. A spectator has no seat. Either way
// the password goes out once.
export function seatPasswordParam(id: ParticipantId, passwordFragment: string | undefined): string {
  if (!isJudgeId(id) && !isPlayerId(id)) {
    return '';
  }
  return passwordFragment === undefined || passwordFragment === '' ? addressBarPasswordParam() : passwordFragment;
}

/** `passwordFragment` is the seat's, as `passwordParam` makes it on the live game page. */
export async function fetchReplayMoves(id: ParticipantId, passwordFragment?: string): Promise<ReplayMovesModel> {
  return readJson(await fetch(`${paths.API_REPLAY_MOVES}?id=${id}${seatPasswordParam(id, passwordFragment)}`));
}

/** Rejects with an `AbortError` when a newer call replaced this one. */
export async function fetchReplayView(id: ParticipantId, saveId: number, viewAs: ReplayViewAs, passwordFragment?: string): Promise<ReplayViewModel> {
  viewAbortController?.abort();
  viewAbortController = new AbortController();
  const url = `${paths.API_REPLAY_VIEW}?id=${id}&save=${saveId}&as=${viewAs}${seatPasswordParam(id, passwordFragment)}`;
  return readJson(await fetch(url, {signal: viewAbortController.signal}));
}

/**
 * Rewinds the running game to before the move saved as `saveId`, and answers the player's view of the rewound game.
 * The seat password comes from `liveView` on the live game page, and from the address bar on the replay page.
 */
export async function postRewind(id: PlayerId, saveId: number, cards: RewindCards, liveView?: PlayerViewModel): Promise<PlayerViewModel> {
  const password = liveView === undefined ? addressBarPasswordParam() : passwordParam(liveView);
  const resp = await fetch(`${paths.API_REWIND}?id=${id}${password}`, {
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

/** The open rewind vote of the table, if any, and whether this player may still ask for one. `password` is the seat's, as `passwordParam` makes it. */
export async function fetchVote(id: PlayerId, password: string): Promise<RewindVotePoll> {
  return readJson(await fetch(`${paths.API_REWIND_VOTE}?id=${id}${seatPasswordParam(id, password)}`));
}

/** Asks for a rewind or answers the open vote, and answers what `fetchVote` would. */
export async function postVote(id: PlayerId, body: VoteBody, password: string): Promise<RewindVotePoll> {
  const resp = await fetch(`${paths.API_REWIND_VOTE}?id=${id}${seatPasswordParam(id, password)}`, {
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
