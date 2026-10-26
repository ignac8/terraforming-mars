import {IGame} from '../IGame';
import {Server} from '../models/ServerModel';
import {RouteError} from '../routes/RouteError';
import {ParticipantId, PlayerId} from '../../common/Types';
import {PlayerInputModel} from '../../common/models/PlayerInputModel';
import {PendingChoiceModel, pendingChoiceOf} from '../../common/models/PendingChoiceModel';
import {PlayerViewModel, PublicPlayerModel} from '../../common/models/PlayerModel';
import {ReplayViewAs, ReplayViewModel} from '../../common/replay/ReplayModel';

/**
 * Builds what a viewer sees of a sandbox game: every player's hand (`'all'`) or one player's view.
 *
 * The view carries the viewer's own id and no prompts, so nothing in it can be used to act in the game. What a
 * prompt offered, like the cards on offer in the research phase, comes as a read-only summary.
 */
export function buildReplayView(sandbox: IGame, viewerId: ParticipantId, saveId: number, viewAs: ReplayViewAs): ReplayViewModel {
  if (viewAs === 'all') {
    const view = Server.getSpectatorModel(sandbox);
    view.players.forEach(scrub);
    return {
      saveId,
      viewAs,
      view: {...view, id: viewerId as typeof view.id},
      privates: sandbox.playersInGenerationOrder.map((p) => {
        const privates = Server.getPrivateFields(p);
        return {...privates, waitingFor: undefined, pendingChoice: summary(privates.waitingFor), color: p.color};
      }),
    };
  }

  const player = sandbox.players.find((p) => p.color === viewAs);
  if (player === undefined) {
    throw RouteError.badRequest('unknown color');
  }
  const view: PlayerViewModel = Server.getPlayerModel(player);
  view.players.forEach(scrub);
  // The viewer may be a spectator, so this is not always a PlayerId.
  // The model carries the seat password. It is blanked here, not left to JSON, so no viewer can ever read it.
  return {
    saveId,
    viewAs,
    view: {...view, id: viewerId as PlayerId, password: undefined, waitingFor: undefined},
    privates: [],
    pendingChoice: summary(view.waitingFor),
  };
}

function summary(waitingFor: PlayerInputModel | undefined): PendingChoiceModel | undefined {
  return waitingFor === undefined ? undefined : pendingChoiceOf(waitingFor);
}

// Models are freshly built, so they are changed in place. Replaying a past save must not show a
// running clock, and must not give out the id of any player.
function scrub(model: PublicPlayerModel): void {
  // The sandbox restarts clocks when it asks players for input. A restart never changes sumElapsed,
  // so with `running` off the time stored in the save is what is shown.
  model.timer = {...model.timer, running: false};
  model.id = undefined;
}
