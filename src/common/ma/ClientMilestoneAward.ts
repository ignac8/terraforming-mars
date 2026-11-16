import {MilestoneName} from './MilestoneName';
import {AwardName} from './AwardName';
import {Expansion} from '../cards/GameModule';
import {BoardName} from '../boards/BoardName';
import {MarsBotGoalNeed} from '../automa/MarsBotGoals';

type ClientMA<T> = {
  name: T;
  description: string;
  requirements: Expansion | undefined;
  automaDescription: string | undefined;
  automaMapDescriptions: Partial<Record<BoardName, string>> | undefined;
  /** What a game must have before MarsBot can play it hand-picked. Undefined when it can't in any game. */
  automaNeeds: ReadonlyArray<MarsBotGoalNeed> | undefined;
}

export type ClientMilestone = ClientMA<MilestoneName>;
export type ClientAward = ClientMA<AwardName>;
