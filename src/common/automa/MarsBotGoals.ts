import {BoardName} from '../boards/BoardName';

/** What a game must have before MarsBot can play some milestone or award. */
export const MARSBOT_GOAL_NEEDS = ['venus', 'turmoil', 'amazonisPlanitia'] as const;
export type MarsBotGoalNeed = typeof MARSBOT_GOAL_NEEDS[number];

/** The parts of a game that decide which hand-picked milestones and awards MarsBot can play. */
export type MarsBotGoalGame = {
  readonly venus: boolean;
  readonly turmoil: boolean;
  /** The maps the game's map is drawn from. */
  readonly boards: ReadonlyArray<BoardName>;
};

/**
 * Whether MarsBot can play a hand-picked milestone or award with these `needs` in `game`.
 *
 * `needs` is undefined for one MarsBot can't play in any game. When the map is drawn from several, one that needs
 * a map counts as playable if that map is among them: only the server knows which map comes up.
 */
export function marsBotCanPlayGoal(needs: ReadonlyArray<MarsBotGoalNeed> | undefined, game: MarsBotGoalGame): boolean {
  if (needs === undefined) {
    return false;
  }
  return needs.every((need) => {
    switch (need) {
    case 'venus':
      return game.venus;
    case 'turmoil':
      return game.turmoil;
    case 'amazonisPlanitia':
      return game.boards.includes(BoardName.AMAZONIS_PLANITIA);
    }
  });
}
