import {PlayerInputType} from '../../common/input/PlayerInputType';
import {InputResponse} from '../../common/inputs/InputResponse';
import {PlayerId} from '../../common/Types';

export type RecordedInput = {
  playerId: PlayerId;
  /** The prompt the answer was for: its PlayerInput `type`, and its title as text (`Message.message` when it is a Message). */
  prompt: {type: PlayerInputType; title: string};
  /** The answer as processed (PlayerInput has already removed runId and requestId). A copy. */
  response: InputResponse;
  /** stateHash of the game just before the answer was applied. */
  stateHash: string;
};
