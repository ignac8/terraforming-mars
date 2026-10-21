import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';

/**
 * The query fragment that identifies this seat's claim, or '' when the game
 * runs without player passwords.
 *
 * Every player-scoped request has to carry it, so any URL built from a player
 * id rather than from `window.location.search` needs this appended.
 *
 * Takes a `ViewModel` because the components that build those URLs are shared
 * with the spectator and judge views. `PlayerViewModel` and `JudgeModel` carry a
 * password (the judge's own, never a player's), so a spectator's model reads as
 * undefined and contributes nothing.
 */
export function passwordParam(view: ViewModel): string {
  const password = (view as PlayerViewModel).password;
  return password === undefined ? '' : '&password=' + encodeURIComponent(password);
}
