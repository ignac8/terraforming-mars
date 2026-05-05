import {IGame} from '../../IGame';
import {IColony} from '../../colonies/IColony';
import {ColonyName} from '../../../common/colonies/ColonyName';
import type {MarsBot} from '../MarsBot';

/**
 * MarsBot colony trading logic (C-17, C-20, C-22, C-24b, C-24c).
 */

/**
 * Returns colony tiles that MarsBot may trade with this generation.
 * C-22: Only tiles not already visited (visitor === undefined) may be traded.
 */
function tradeableColonies(game: IGame): Array<IColony> {
  return game.colonies.filter((colony) => colony.isActive && colony.visitor === undefined);
}

/**
 * C-17c: Break a tie among candidate tiles by flipping a project card.
 * Uses cost − 1 as a 0-based index (same as C-15b random colony selection).
 * Discards the flipped card.
 */
function selectTiedColony(game: IGame, candidates: Array<IColony>): IColony {
  const flipped = game.projectDeck.drawN(game, 1);
  if (flipped.length === 0) return candidates[0];
  const card = flipped[0];
  // Use positive modulo: cost=0 cards (e.g. IndenturedWorkers) would give -1 % N in JS
  const n = candidates.length;
  const index = ((card.cost - 1) % n + n) % n;
  game.projectDeck.discardPile.push(card);
  return candidates[index];
}

/**
 * Select the colony tile for MarsBot to trade with (C-17a/b/c).
 *
 * Priority:
 *   C-17a: Highest track position.
 *   C-17b: Tiebreak — prefer tiles where MarsBot already has a colony.
 *   C-17c: Tiebreak — random via project-card cost.
 *
 * Returns undefined if no tradeable colonies exist.
 */
export function selectTradeColony(game: IGame, marsBot: MarsBot): IColony | undefined {
  const tradeable = tradeableColonies(game);
  if (tradeable.length === 0) return undefined;
  if (tradeable.length === 1) return tradeable[0];

  // C-17a: highest track position
  const maxTrack = Math.max(...tradeable.map((c) => c.trackPosition));
  let candidates = tradeable.filter((c) => c.trackPosition === maxTrack);
  if (candidates.length === 1) return candidates[0];

  // C-17b: prefer tiles where MarsBot has a colony
  const withMarsBotColony = candidates.filter((c) => c.colonies.includes(marsBot.player.id));
  if (withMarsBotColony.length === 1) return withMarsBotColony[0];
  if (withMarsBotColony.length > 1) {
    candidates = withMarsBotColony;
  }

  // C-17c: random among remaining tied candidates
  return selectTiedColony(game, candidates);
}

/**
 * Execute MarsBot's trade action with the given colony tile.
 *
 * C-17d: MarsBot loses 1 MC before trading.
 * C-20:  MarsBot ignores colony track income; gains 2 resources into the
 *         corresponding shipping board area. +1 extra if it already has a colony
 *         there. Human players with colonies receive their colony bonus per core rules.
 * C-22:  Marks the colony tile as visited.
 * C-24b: Europa — MarsBot raises TR 1 step instead of gaining 2 resources.
 *
 * Also resets the colony track position after trade (per core rules).
 */
export function tradeWithColony(marsBot: MarsBot, colony: IColony): void {
  const game = marsBot.game;

  // C-17d: MarsBot loses 1 MC
  marsBot.turnResolver.mcSupply = Math.max(0, marsBot.turnResolver.mcSupply - 1);
  game.log('MarsBot pays 1 MC to trade with ${0} (C-17d)', (b) => b.colony(colony));

  // C-22: Mark trade fleet used on this tile
  colony.visitor = marsBot.player.id;

  // C-24b: Europa — raise TR 1 step instead of resources
  if (colony.name === ColonyName.EUROPA) {
    marsBot.player.increaseTerraformRating(1);
    game.log('MarsBot trades with Europa, raises TR 1 step (C-24b)');
  } else {
    // C-20: base 2 resources; +1 if MarsBot already has a colony here
    const amount = colony.colonies.includes(marsBot.player.id) ? 3 : 2;
    // C-23: Titan storage is only used without Venus Next; with Venus, gain floaters instead
    if (colony.name === ColonyName.TITAN && game.gameOptions.venusNextExtension) {
      marsBot.floaterCount += amount;
      game.log(
        'MarsBot trades with Titan, gains ${0} floater(s) (C-20, C-23)',
        (b) => b.number(amount),
      );
    } else {
      marsBot.shippingBoard.add(colony.name, amount, marsBot);
      game.log(
        'MarsBot trades with ${0}, gains ${1} resource(s) to storage (C-20)',
        (b) => b.colony(colony).number(amount),
      );
    }
  }

  // C-20: Human players with a colony here receive their colony bonus per core rules.
  // (MarsBot's own colony "bonus" is the +1 extra resource handled above, not the tile bonus.)
  for (const playerId of colony.colonies) {
    if (playerId === marsBot.player.id) continue;
    const humanPlayer = game.players.find((p) => p.id === playerId);
    if (humanPlayer !== undefined) {
      // isGiveColonyBonus=false so complex bonuses are deferred into the game queue.
      colony.giveColonyBonus(humanPlayer);
    }
  }

  // Reset colony track to number of colonies after trade (per core colony rules)
  colony.trackPosition = colony.colonies.length;
}
