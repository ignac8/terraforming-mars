import {DifficultyLevel} from './AutomaTypes';
import {CubeType} from './MarsBotCorpTypes';

/** Track state sent to the client for display. */
export interface MarsBotTrackModel {
  num: number;
  tagNames: ReadonlyArray<string>;
  position: number;
  maxPosition: number;
}

/** MarsBot VP breakdown sent to client at game end. */
export interface MarsBotVPModel {
  terraformRating: number;
  milestones: number;
  awards: number;
  greenery: number;
  cityAdjacentGreenery: number;
  neuralInstance: number;
  mcToVP: number;
  cardVP: number;
  total: number;
}

/** MarsBot state model sent to the client. */
export interface MarsBotModel {
  difficulty: DifficultyLevel;
  tracks: ReadonlyArray<MarsBotTrackModel>;
  mcSupply: number;
  actionDeckSize: number;
  bonusDeckSize: number;
  /** Only populated at game end. */
  vpBreakdown?: MarsBotVPModel;
  /** Whether MarsBot wins by generation limit. */
  instantWin?: boolean;
  /** Corporation ID if playing with corp rules. */
  corpId?: string;
  /** Corporation display name. */
  corpName?: string;
  /** Track cubes placed by the corporation. */
  trackCubes?: ReadonlyArray<{trackNum: number, position: number, cubeType: CubeType}>;
}
