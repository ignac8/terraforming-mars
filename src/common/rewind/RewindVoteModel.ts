import {Color} from '../Color';
import {RewindCards} from '../replay/ReplayModel';

export type RewindVoteStatus = 'open' | 'rewinding' | 'passed' | 'declined' | 'cancelled' | 'expired' | 'moved-on' | 'froze' | 'judge-rewound' | 'failed';
export type RewindVoteChoice = 'yes' | 'no' | 'pending';

export type RewindVoteModel = {
  voteId: number;
  status: RewindVoteStatus;
  requester: Color;
  saveId: number;
  moveNumber: number;
  generation: number;
  cards: RewindCards;
  /** Every player but the requester, in generation order. */
  votes: Array<{color: Color; choice: RewindVoteChoice}>;
  /** 0 unless the vote is open. Relative, so client clock skew doesn't matter. */
  expiresInMs: number;
  /** For 'failed': the refusal text. */
  reason?: string;
};

/** Why a player may not ask for a rewind right now: the game is frozen, a vote is open, or they are barred until the next generation. */
export type RequestBlock = 'frozen' | 'vote-open' | 'barred';

/** What the vote route refuses a request with while a vote is open. */
export const VOTE_ALREADY_OPEN = 'A rewind vote is already open.';

/**
 * What the vote route answers. `undoCount` rising tells a page that a rewind happened. `mayRequest` is false while
 * `blocked` has a reason, and for a player who has no say in the table's rewinds.
 */
export type RewindVotePoll = {undoCount: number; vote: RewindVoteModel | undefined; mayRequest: boolean; blocked?: RequestBlock};

/**
 * How often a page of a finished game polls the vote. A finished game is evicted from memory soon after it ends,
 * and every poll that finds it gone reads it from the database again.
 */
export const FINISHED_GAME_VOTE_POLL_MS = 10_000;
