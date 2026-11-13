import {BoardName} from '../boards/BoardName';

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
