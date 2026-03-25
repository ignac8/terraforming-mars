import {Tag} from '../cards/Tag';

/** Actions that can appear on MarsBot board track positions. */
export type TrackAction =
  | 'advance'       // Move cube 1 more space (may chain)
  | 'tr1' | 'tr2' | 'tr3' | 'tr4' | 'tr5' | 'tr6' | 'tr7' | 'tr8'
  | 'milestone'
  | 'award'
  | 'temperature' | 'temperature2'
  | 'greenery'
  | 'ocean'
  | 'city'
  | 'venus' | 'venus2'
  | `tag_${number}`; // Advance another track by its 1-based index

/** A single track on the MarsBot board (19 positions: 0–18). */
export type TrackLayout = ReadonlyArray<TrackAction | null>;

/** Definition of one MarsBot track: which tags and production types map to it. */
export interface TrackDefinition {
  readonly num: number; // 1-based track index
  readonly tags: ReadonlyArray<Tag>;
  readonly productions: ReadonlyArray<string>; // e.g. 'Steel', 'Titanium'
  readonly layout: TrackLayout;
}

/** Complete MarsBot board data for a specific map. */
export interface MarsBotBoardData {
  readonly trackDefs: ReadonlyArray<TrackDefinition>;
  readonly awardFormulas: Record<string, string>;
  readonly milestoneCriteria: Record<string, string>;
}

export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'brutal';

export enum BonusCardId {
  B01_METEOR_SHOWER = 'B01',
  B02_INVASIVE_SPECIES = 'B02',
  B03_RESEARCH_AND_DEVELOPMENT = 'B03',
  B04_OVERACHIEVEMENT = 'B04',
  B05_EXPEDITED_CONSTRUCTION = 'B05',
  B06_LOBBYISTS = 'B06',
  B07_LOCAL_NEURAL_INSTANCE = 'B07',
  B08_CORPORATE_COMPETITION = 'B08',
}

/** The set of bonus cards used in the base game (no expansions). */
export const BASE_BONUS_CARDS: ReadonlyArray<BonusCardId> = [
  BonusCardId.B01_METEOR_SHOWER,
  BonusCardId.B02_INVASIVE_SPECIES,
  BonusCardId.B03_RESEARCH_AND_DEVELOPMENT,
  BonusCardId.B04_OVERACHIEVEMENT,
  BonusCardId.B05_EXPEDITED_CONSTRUCTION,
  BonusCardId.B06_LOBBYISTS,
  BonusCardId.B07_LOCAL_NEURAL_INSTANCE,
  BonusCardId.B08_CORPORATE_COMPETITION,
];

/** MC gained when MarsBot takes a failed action. */
export const FAILED_ACTION_MC = 5;
export const FAILED_ACTION_MC_EASY = 3;

export const MARSBOT_MAX_TRACK_POSITION = 18;
export const MARSBOT_STARTING_TR = 20;
export const MARSBOT_MAX_GENERATION = 20;
export const MARSBOT_MAX_GENERATION_PRELUDE = 18;

/** Whether this automa game uses Prelude rules (shorter game, wild tags, etc.). */
export function isAutomaPreludeGame(preludeExtension: boolean, prelude2Expansion: boolean): boolean {
  return preludeExtension || prelude2Expansion;
}

/** Get the max generation for an automa game. */
export function getAutomaMaxGeneration(preludeExtension: boolean, prelude2Expansion: boolean): number {
  return isAutomaPreludeGame(preludeExtension, prelude2Expansion)
    ? MARSBOT_MAX_GENERATION_PRELUDE
    : MARSBOT_MAX_GENERATION;
}

/** Build MC-to-VP table for a given max generation. mcPerVP goes 8→1 over the last 8 generations. */
function buildMcToVpTable(maxGen: number): ReadonlyArray<{maxGeneration: number, mcPerVP: number}> {
  const table: Array<{maxGeneration: number, mcPerVP: number}> = [];
  for (let mcPerVP = 8; mcPerVP >= 1; mcPerVP--) {
    table.push({maxGeneration: maxGen - mcPerVP, mcPerVP});
  }
  return table;
}

/** MC-to-VP conversion table by generation number at game end (base game, no Prelude). */
export const MC_TO_VP_TABLE = buildMcToVpTable(MARSBOT_MAX_GENERATION);

/** MC-to-VP conversion table when playing with Prelude (shorter game). */
export const MC_TO_VP_TABLE_PRELUDE = buildMcToVpTable(MARSBOT_MAX_GENERATION_PRELUDE);
