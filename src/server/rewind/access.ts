import {IGame} from '../IGame';
import {ParticipantId} from '../../common/Types';
import {RouteError} from '../routes/RouteError';

/** The one human player of a solo or MarsBot game with Player undo on. */
export function canRewind(game: IGame, participantId: ParticipantId): boolean {
  return game.players.length === 1 && game.gameOptions.undoOption && game.players[0].id === participantId;
}

/** The judge of a game with Judge undo on. */
export function judgeCanRewind(game: IGame, participantId: ParticipantId): boolean {
  return game.gameOptions.judgeUndo && game.judgeId !== undefined && participantId === game.judgeId;
}

/**
 * The refusal of a request for the moves and lines a rewind undid, which only the judge of a Judge undo game and the
 * player of a solo or MarsBot game may make.
 */
export function checkMayShowUndone(game: IGame, participantId: ParticipantId): void {
  if (!judgeCanRewind(game, participantId) && !canRewind(game, participantId)) {
    throw RouteError.forbidden();
  }
}

/** A player of a multiplayer game with Player undo: may browse its history and ask for a rewind by vote, also at a table with a judge. */
export function canVoteRewind(game: IGame, participantId: ParticipantId): boolean {
  return game.players.length > 1 && game.gameOptions.undoOption && game.players.some((p) => p.id === participantId);
}

/** Who may browse a running game's history: whoever could rewind it. */
export function canBrowseHistory(game: IGame, participantId: ParticipantId): boolean {
  return canRewind(game, participantId) || judgeCanRewind(game, participantId) || canVoteRewind(game, participantId);
}
