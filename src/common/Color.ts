export const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue', 'black', 'purple', 'orange', 'pink', 'turquoise', 'clear'] as const;
export type PlayerColor = typeof PLAYER_COLORS[number];
const ALL_COLORS = [...PLAYER_COLORS, 'neutral', 'bronze'] as const;
export type Color = typeof ALL_COLORS[number];
export type ColorWithNeutral = Color | 'NEUTRAL';

/**
 * English display name of each player color, as shown to players.
 *
 * "Clear" is already the label of a button that clears a selection, so that color is "Transparent".
 */
export const PLAYER_COLOR_LABELS: Readonly<Record<PlayerColor, string>> = {
  red: 'Red',
  green: 'Green',
  yellow: 'Yellow',
  blue: 'Blue',
  black: 'Black',
  purple: 'Purple',
  orange: 'Orange',
  pink: 'Pink',
  turquoise: 'Turquoise',
  clear: 'Transparent',
};
