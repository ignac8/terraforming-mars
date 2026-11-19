import {BoardName} from '../boards/BoardName';

/** MarsBot's rule differences on one map, as offsets from the standard maps. */
export type MarsBotMapRules = {
  /** Generations added to MarsBot's generation limit. */
  readonly extraGenerations: number;
  /** Generations by which the thresholds of cards that name a generation move later. */
  readonly generationShift: number;
  /** Terraform rating taken off MarsBot's starting rating with Turmoil, on top of the standard reduction. */
  readonly turmoilTRExtra: number;
  /** Spaces by which the 2nd Trade Fleet cube (Colonies) moves up the Energy track from space 9. */
  readonly tradeFleetCubeShift: number;
};

const STANDARD_RULES: MarsBotMapRules = {extraGenerations: 0, generationShift: 0, turmoilTRExtra: 0, tradeFleetCubeShift: 0};
const AMAZONIS_PLANITIA_RULES: MarsBotMapRules = {extraGenerations: 2, generationShift: 1, turmoilTRExtra: 1, tradeFleetCubeShift: 1};

/** The rules MarsBot follows on `boardName`. */
export function marsBotMapRules(boardName: BoardName): MarsBotMapRules {
  return boardName === BoardName.AMAZONIS_PLANITIA ? AMAZONIS_PLANITIA_RULES : STANDARD_RULES;
}
