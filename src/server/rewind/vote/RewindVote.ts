import {IGame} from '../../IGame';
import {PlayerId} from '../../../common/Types';
import {RewindVoteModel, RewindVoteStatus} from '../../../common/rewind/RewindVoteModel';
import {RewindRequestLimits, SerializedRewindVote} from '../tableState';

export const VOTE_EXPIRY_MS = 2 * 60 * 1000;
export const ENDED_VOTE_SHOWN_MS = 60 * 1000;

/** A vote that has ended, kept in memory only, to be shown for ENDED_VOTE_SHOWN_MS. */
export type EndedVote = {
  vote: SerializedRewindVote;
  status: Exclude<RewindVoteStatus, 'open' | 'rewinding'>;
  endedAt: number;
  no?: PlayerId;
  reason?: string;
};

export function everyoneAgreed(vote: SerializedRewindVote, game: IGame): boolean {
  return game.players.every((player) => vote.yes.includes(player.id));
}

/** Whether an open vote's time is up. Never true for a 'rewinding' vote. */
export function isDue(vote: SerializedRewindVote, now: number): boolean {
  return vote.status === 'open' && now >= vote.expiresAt;
}

function modelOf(
  game: IGame,
  vote: SerializedRewindVote,
  status: RewindVoteStatus,
  expiresInMs: number,
  no: PlayerId | undefined,
  reason: string | undefined,
): RewindVoteModel {
  const requester = game.players.find((player) => player.id === vote.requester);
  if (requester === undefined) {
    throw new Error(`Rewind vote ${vote.id} has no requester in this game`);
  }
  const model: RewindVoteModel = {
    voteId: vote.id,
    status,
    requester: requester.color,
    saveId: vote.saveId,
    moveNumber: vote.moveNumber,
    generation: vote.generation,
    cards: vote.cards,
    votes: game.playersInGenerationOrder
      .filter((player) => player.id !== vote.requester)
      .map((player) => ({
        color: player.color,
        choice: vote.yes.includes(player.id) ? 'yes' : player.id === no ? 'no' : 'pending',
      })),
    expiresInMs,
  };
  if (reason !== undefined) {
    model.reason = reason;
  }
  return model;
}

/** The model of the game's vote, or of `ended` while it is shown; undefined otherwise. */
export function voteModel(game: IGame, ended: EndedVote | undefined, now: number): RewindVoteModel | undefined {
  const vote = game.rewindVote;
  if (vote !== undefined) {
    return modelOf(game, vote, vote.status, Math.max(0, vote.expiresAt - now), undefined, undefined);
  }
  if (ended !== undefined && now < ended.endedAt + ENDED_VOTE_SHOWN_MS) {
    return modelOf(game, ended.vote, ended.status, 0, ended.no, ended.reason);
  }
  return undefined;
}

/** False only if `player` is in `limits` and `limits.generation === game.generation`. */
export function mayRequest(limits: RewindRequestLimits | undefined, game: IGame, player: PlayerId): boolean {
  return limits === undefined || limits.generation !== game.generation || !limits.players.includes(player);
}

/** Adds `player` for the game's current generation, starting a fresh list when the generation has changed. */
export function barUntilNextGeneration(limits: RewindRequestLimits | undefined, game: IGame, player: PlayerId): RewindRequestLimits {
  const players = limits?.generation === game.generation ? limits.players : [];
  return {generation: game.generation, players: players.includes(player) ? [...players] : [...players, player]};
}
