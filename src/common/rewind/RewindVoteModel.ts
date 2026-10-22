import {Color} from '../Color';
import {RewindCards} from '../replay/ReplayModel';

export type RewindVoteStatus = 'open' | 'rewinding' | 'passed' | 'declined' | 'cancelled' | 'expired' | 'moved-on' | 'failed';
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
  /** 0 once the vote has ended. Relative, so client clock skew doesn't matter. */
  expiresInMs: number;
  /** For 'failed': the refusal text. */
  reason?: string;
};

/** What the vote route answers. `undoCount` rising tells a page that a rewind happened. `mayRequest` is false for a player barred this generation. */
export type RewindVotePoll = {undoCount: number; vote: RewindVoteModel | undefined; mayRequest: boolean};
