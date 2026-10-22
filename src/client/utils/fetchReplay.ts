import {paths} from '@/common/app/paths';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ReplayMovesModel, ReplayViewAs, ReplayViewModel, RewindCards, RewindClocks} from '@/common/replay/ReplayModel';
import {RewindVotePoll} from '@/common/rewind/RewindVoteModel';
import {isJudgeId, isPlayerId, JudgeId, ParticipantId, PlayerId} from '@/common/Types';
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

// A serverId visit leaves an open judge seat unclaimed, and a judge request that carries neither the seat's password
// nor the serverId would claim it. So a judge's requests carry the serverId of the address bar as well, and so does the
// link back to the judge page, whose first poll would claim the seat otherwise.
export function judgeCredentials(id: ParticipantId, passwordFragment: string | undefined): string {
  const serverId = isJudgeId(id) ? new URLSearchParams(window.location.search).get('serverId') : null;
  return seatPasswordParam(id, passwordFragment) + (serverId === null ? '' : '&serverId=' + encodeURIComponent(serverId));
}

// The judge asks for the moves a rewind undid, which only the judge of a Judge undo game is given.
function undoneParam(undone: boolean): string {
  return undone ? '&undone=1' : '';
}

/**
 * `passwordFragment` is the seat's, as `passwordParam` makes it on the live game page. `undone`: the judge's list with the
 * moves that rewinds undid.
 */
export async function fetchReplayMoves(id: ParticipantId, passwordFragment?: string, undone: boolean = false): Promise<ReplayMovesModel> {
  return readJson(await fetch(`${paths.API_REPLAY_MOVES}?id=${id}${judgeCredentials(id, passwordFragment)}${undoneParam(undone)}`));
}

/** Rejects with an `AbortError` when a newer call replaced this one. `undone`: the save is one that a rewind undid. */
export async function fetchReplayView(id: ParticipantId, saveId: number, viewAs: ReplayViewAs, passwordFragment?: string, undone: boolean = false): Promise<ReplayViewModel> {
  viewAbortController?.abort();
  viewAbortController = new AbortController();
  const url = `${paths.API_REPLAY_VIEW}?id=${id}&save=${saveId}&as=${viewAs}${judgeCredentials(id, passwordFragment)}${undoneParam(undone)}`;
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

async function postJudge(path: string, id: JudgeId, body: object, passwordFragment: string | undefined): Promise<void> {
  const resp = await fetch(`${path}?id=${id}${judgeCredentials(id, passwordFragment)}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  await checkOk(resp);
}

/**
 * Rewinds the running game to before the move saved as `saveId`, as the judge, who leaves it frozen. The routes answer
 * the judge's model of the rewound game, which is left to the next poll. `passwordFragment` is the judge's, as
 * `passwordParam` makes it on the judge page. Without it the password comes from the address bar.
 */
export function postJudgeRewind(id: JudgeId, saveId: number, cards: RewindCards, clocks: RewindClocks, passwordFragment?: string): Promise<void> {
  return postJudge(paths.API_JUDGE_REWIND, id, {saveId, cards, clocks}, passwordFragment);
}

/** Freezes the game, or unfreezes it. `passwordFragment` is as for `postJudgeRewind`. */
export function postJudgeFreeze(id: JudgeId, frozen: boolean, passwordFragment?: string): Promise<void> {
  return postJudge(paths.API_JUDGE_FREEZE, id, {frozen}, passwordFragment);
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
