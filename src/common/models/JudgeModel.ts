import {Color} from '../Color';
import {JudgeId, Password} from '../Types';
import {PrivatePlayerFields, ViewModel} from './PlayerModel';

export type JudgePlayerModel = PrivatePlayerFields & {color: Color};

/** A judge's view of the game: the public view plus every player's private fields. */
export interface JudgeModel extends ViewModel {
  id: JudgeId;
  color: 'neutral';
  /** The judge's own password, never a player's. */
  password: Password | undefined;
  /** Changes whenever the game changes, so the judge page knows when to refetch. */
  signature: string;
  /** One entry per player, in the same order as `players`. */
  privates: Array<JudgePlayerModel>;
}
