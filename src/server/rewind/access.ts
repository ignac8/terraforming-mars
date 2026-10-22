import {IGame} from '../IGame';
import {ParticipantId} from '../../common/Types';

/** The one human player of a solo or MarsBot game with Player undo on. */
export function canRewind(game: IGame, participantId: ParticipantId): boolean {
  return game.players.length === 1 && game.gameOptions.undoOption && game.players[0].id === participantId;
}
