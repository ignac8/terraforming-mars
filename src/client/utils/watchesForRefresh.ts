import {PlayerViewModel} from '@/common/models/PlayerModel';

/** A player page that keeps polling while its player owes an answer, so that a freeze or a judge rewind reaches it. */
export function watchesForRefresh(view: PlayerViewModel): boolean {
  return view.game.gameOptions.judgeUndo;
}
