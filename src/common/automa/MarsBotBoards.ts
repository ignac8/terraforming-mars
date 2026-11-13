import {BoardName} from '../boards/BoardName';
import {RandomMAOptionType} from '../ma/RandomMAOptionType';

/**
 * Maps with a MarsBot board.
 *
 * The first six ship with the automa rulebooks (Terra Cimmeria and Vastitas Borealis are the official
 * Nova maps). Amazonis Planitia's board is this project's own design.
 */
export const MARSBOT_BOARD_NAMES: ReadonlyArray<BoardName> = [
  BoardName.THARSIS,
  BoardName.HELLAS,
  BoardName.ELYSIUM,
  BoardName.UTOPIA_PLANITIA,
  BoardName.VASTITAS_BOREALIS_NOVA,
  BoardName.TERRA_CIMMERIA_NOVA,
  BoardName.AMAZONIS_PLANITIA,
];

/** Whether a board can be played against MarsBot. */
export function isMarsBotBoardChoice(board: BoardName): boolean {
  return MARSBOT_BOARD_NAMES.includes(board);
}

/**
 * Whether the Milestones & Awards expansion keeps MarsBot off `board`.
 *
 * The expansion counts as on when its option is set and random milestones and awards are not off,
 * because the create-game form sends the option even when they are. With it the rulebook has MarsBot
 * use the Tharsis board whatever the map, and no rule covers Amazonis Planitia's bigger map, so MarsBot
 * stays off it.
 */
export function modularMABlocksMarsBot(board: BoardName, options: {readonly modularMA: boolean, readonly randomMA: RandomMAOptionType}): boolean {
  return board === BoardName.AMAZONIS_PLANITIA && options.modularMA && options.randomMA !== RandomMAOptionType.NONE;
}
