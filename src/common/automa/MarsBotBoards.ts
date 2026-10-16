import {BoardName} from '../boards/BoardName';
import {RandomBoardOption} from '../boards/RandomBoardOption';

/** Maps that ship with a MarsBot board. Terra Cimmeria and Vastitas Borealis are the official Nova maps. */
export const MARSBOT_BOARD_NAMES: ReadonlyArray<BoardName> = [
  BoardName.THARSIS,
  BoardName.HELLAS,
  BoardName.ELYSIUM,
  BoardName.UTOPIA_PLANITIA,
  BoardName.VASTITAS_BOREALIS_NOVA,
  BoardName.TERRA_CIMMERIA_NOVA,
];

/** Whether a create-game board choice can be played against MarsBot. The official random pool only holds MarsBot maps. */
export function isMarsBotBoardChoice(board: BoardName | RandomBoardOption): boolean {
  return board === RandomBoardOption.OFFICIAL || MARSBOT_BOARD_NAMES.includes(board as BoardName);
}
