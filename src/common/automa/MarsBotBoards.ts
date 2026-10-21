import {BoardName} from '../boards/BoardName';

/** Maps that ship with a MarsBot board. Terra Cimmeria and Vastitas Borealis are the official Nova maps. */
export const MARSBOT_BOARD_NAMES: ReadonlyArray<BoardName> = [
  BoardName.THARSIS,
  BoardName.HELLAS,
  BoardName.ELYSIUM,
  BoardName.UTOPIA_PLANITIA,
  BoardName.VASTITAS_BOREALIS_NOVA,
  BoardName.TERRA_CIMMERIA_NOVA,
];

/** Whether a board can be played against MarsBot. */
export function isMarsBotBoardChoice(board: BoardName): boolean {
  return MARSBOT_BOARD_NAMES.includes(board);
}
