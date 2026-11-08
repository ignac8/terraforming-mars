import {Tag} from '../cards/Tag';

export type MADetail = {message: string, messageArgs?: Array<string>, victoryPoint: number};

/** The message of an award's `MADetail`. Its arguments are the place, the award's name and the name of who funded it. */
export const AWARD_DETAIL_MESSAGE = '${0} place for ${1} award (funded by ${2})';

export type VictoryPointsBreakdown = {
  terraformRating: number;
  milestones: number;
  awards: number;
  greenery: number;
  city: number;
  escapeVelocity: number;
  moonHabitats: number;
  moonMines: number;
  moonRoads: number;
  planetaryTracks: number;
  victoryPoints: number;
  total: number;
  detailsCards: ReadonlyArray<{cardName: string, victoryPoint: number}>;
  detailsMilestones: ReadonlyArray<MADetail>;
  detailsAwards: ReadonlyArray<MADetail>;
  detailsPlanetaryTracks: ReadonlyArray<{tag: Tag, points: number}>;
  // Total VP less than 0. For Underworld
  negativeVP: number;
}
