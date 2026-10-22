import {IGame} from '../IGame';
import {ParticipantId} from '../../common/Types';

/** The one human player of a solo or MarsBot game with Player undo on. */
export function canRewind(game: IGame, participantId: ParticipantId): boolean {
  return game.players.length === 1 && game.gameOptions.undoOption && game.players[0].id === participantId;
}

/** The judge of a game with Judge undo on. */
export function judgeCanRewind(game: IGame, participantId: ParticipantId): boolean {
  return game.gameOptions.judgeUndo && game.judgeId !== undefined && participantId === game.judgeId;
}

/** A player of a multiplayer game with Player undo and without Judge undo: may browse its history and ask for a rewind by vote. */
export function canVoteRewind(game: IGame, participantId: ParticipantId): boolean {
  return game.players.length > 1 && game.gameOptions.undoOption && !game.gameOptions.judgeUndo &&
    game.players.some((p) => p.id === participantId);
}

/** Who may browse a running game's history: whoever could rewind it. */
export function canBrowseHistory(game: IGame, participantId: ParticipantId): boolean {
  return canRewind(game, participantId) || judgeCanRewind(game, participantId) || canVoteRewind(game, participantId);
}
