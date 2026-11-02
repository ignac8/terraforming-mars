import {IGame} from '../IGame';
import {ParticipantId} from '../../common/Types';
import {RouteError} from '../routes/RouteError';
import {Phase} from '../../common/Phase';

/** The one human player of a solo or MarsBot game with Player undo on. */
export function canRewind(game: IGame, participantId: ParticipantId): boolean {
  return game.players.length === 1 && game.gameOptions.undoOption && game.players[0].id === participantId;
}

/** The refusal of a request for the moves and lines a rewind undid, which only the player of a solo or MarsBot game may make. */
export function checkMayShowUndone(game: IGame, participantId: ParticipantId): void {
  if (!canRewind(game, participantId)) {
    throw RouteError.forbidden();
  }
}

/**
 * A player of a running multiplayer game with Player undo: may browse its history and ask for a rewind by vote.
 * A finished game shows every player's id on its results page, so it is no longer rewound by vote.
 */
export function canVoteRewind(game: IGame, participantId: ParticipantId): boolean {
  return game.players.length > 1 && game.gameOptions.undoOption && game.phase !== Phase.END &&
    game.players.some((p) => p.id === participantId);
}

/** Who may browse a running game's history: whoever could rewind it. */
export function canBrowseHistory(game: IGame, participantId: ParticipantId): boolean {
  return canRewind(game, participantId) || canVoteRewind(game, participantId);
}
