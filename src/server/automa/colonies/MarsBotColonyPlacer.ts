import {IGame} from '../../IGame';
import {IColony} from '../../colonies/IColony';
import {ColonyName} from '../../../common/colonies/ColonyName';
import type {MarsBot} from '../MarsBot';

/**
 * Handles MarsBot colony placement logic (C-15b, C-16a, C-19, C-24a, C-24d).
 */

/**
 * Returns all colony tiles eligible for MarsBot to build a colony on.
 * Eligible = active, not full, and MarsBot doesn't already have a colony there.
 */
export function eligibleColoniesForMarsBot(game: IGame, marsBot: MarsBot): Array<IColony> {
  return game.colonies.filter((colony) => {
    if (!colony.isActive) return false;
    if (colony.isFull()) return false;
    if (colony.colonies.includes(marsBot.player.id)) return false;
    return true;
  });
}

/**
 * C-15b / C-16a: Randomly select a colony tile for MarsBot to build on.
 *
 * Method: flip 1 card from the project deck; use `(cost - 1) % eligible.length`
 * to pick the tile. Discard the flipped card.
 *
 * Returns the selected colony, or undefined if no eligible tiles.
 */
export function selectRandomColony(game: IGame, marsBot: MarsBot): IColony | undefined {
  const eligible = eligibleColoniesForMarsBot(game, marsBot);
  if (eligible.length === 0) return undefined;

  const flipped = game.projectDeck.drawN(game, 1);
  if (flipped.length === 0) return undefined;

  const card = flipped[0];
  const index = (card.cost - 1) % eligible.length;
  // Discard the flipped card back to the project deck discard pile
  game.projectDeck.discardPile.push(card);

  return eligible[index];
}

/**
 * Place a colony for MarsBot on the given colony tile.
 *
 * C-19: MarsBot ignores the printed tile reward; gains 2 resources into the
 *       corresponding shipping board storage area instead.
 * C-24a: Europa — place an ocean tile (raise TR 1) instead of 2 resources.
 *         If impossible, Failed Action. No storage.
 * C-23: Titan + !venusNext — add 2 to Titan storage (floaters).
 *        Titan + venusNext — add 2 floaters to floaterCount.
 */
export function placeColonyForMarsBot(colony: IColony, marsBot: MarsBot): void {
  const game = marsBot.game;
  const colonyName = colony.name;

  // C-24a: Europa — place an ocean tile instead of 2 resources
  if (colonyName === ColonyName.EUROPA) {
    // Check both conditions before touching the colony
    if (!game.canAddOcean() || marsBot.turnResolver.tilePlacer.findOceanSpace() === undefined) {
      // Failed Action: ocean can't be placed
      marsBot.turnResolver.failedAction();
      return;
    }
    // Add colony for ownership tracking (no build bonus — ocean is the reward, C-24a)
    directAddColony(colony, marsBot);
    // placeOcean handles tile placement, TR gain, and placement bonuses
    marsBot.turnResolver.placeOcean();
    return;
  }

  // All other tiles: add colony and give 2 resources to shipping board (C-19)
  directAddColony(colony, marsBot);

  // C-23: Titan handling
  if (colonyName === ColonyName.TITAN) {
    if (!game.gameOptions.venusNextExtension) {
      // Without Venus: store as floaters in Titan shipping board area
      marsBot.shippingBoard.add(ColonyName.TITAN, 2, marsBot);
      game.log('MarsBot builds colony on Titan, gains 2 floaters in Titan storage (C-19/C-23)');
    } else {
      // With Venus: add 2 floaters to floaterCount
      marsBot.floaterCount += 2;
      game.log('MarsBot builds colony on Titan, gains 2 floaters (C-19, Venus rules)');
    }
    return;
  }

  // Standard colony placement: 2 resources to shipping board (C-19)
  marsBot.shippingBoard.add(colonyName, 2, marsBot);
  game.log('MarsBot builds colony on ${0}, gains 2 resources in storage (C-19)', (b) => b.colony(colony));
}

/**
 * Directly add MarsBot to a colony tile without giving the printed build bonus.
 * Updates the colony array and track position. Fires onColonyAddedByAnyPlayer callbacks.
 */
function directAddColony(colony: IColony, marsBot: MarsBot): void {
  colony.colonies.push(marsBot.player.id);
  // Keep track position at least equal to the number of colonies (per Colony.ts addColony)
  if (colony.trackPosition < colony.colonies.length) {
    colony.trackPosition = colony.colonies.length;
  }

  // Fire onColonyAddedByAnyPlayer callbacks for players with relevant cards
  for (const player of marsBot.game.players) {
    for (const card of player.tableau) {
      card.onColonyAddedByAnyPlayer?.(player, marsBot.player);
    }
  }

  // C-33: notify corp effect (e.g. Poseidon advances least-advanced track)
  marsBot.corp?.effect?.onColonyPlaced?.(marsBot.getCorpContext());

  marsBot.game.log('MarsBot builds colony on ${0}', (b) => b.colony(colony));
}
