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

/** What the vote route answers. `undoCount` rising tells a page that a rewind happened. `mayRequest` is false for a player barred this generation. */
export type RewindVotePoll = {undoCount: number; vote: RewindVoteModel | undefined; mayRequest: boolean};

/**
 * How often a page of a finished game polls the vote. A finished game is evicted from memory soon after it ends,
 * and every poll that finds it gone reads it from the database again.
 */
export const FINISHED_GAME_VOTE_POLL_MS = 10_000;
