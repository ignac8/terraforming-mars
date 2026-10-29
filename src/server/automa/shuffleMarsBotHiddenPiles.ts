import {SerializedAutomaState} from '../SerializedGame';
import {Random} from '../../common/utils/Random';
import {inplaceShuffle} from '../utils/shuffle';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {CardName} from '../../common/cards/CardName';

/**
 * Reorders the piles of MarsBot's that no player has seen: its action deck and its bonus deck's draw pile.
 *
 * Tyco Magnetics puts Interface Hyperlink at the bottom of the bonus deck, where everyone knows it is, so a card
 * there stays. The bonus deck draws from the end of its draw pile, so the bottom is the start.
 */
export function shuffleMarsBotHiddenPiles(state: SerializedAutomaState, random: Random): void {
  inplaceShuffle(state.actionDeckCardNames, random);
  // Older saves hold the draw pile under its own key, bonus cards by id
  const pile: Array<string> = state.bonusDeck?.drawPile ?? state.bonusDeckDrawPile ?? [];
  if (pile[0] === CardName.AUTOMA_INTERFACE_HYPERLINK || pile[0] === BonusCardId.B30_INTERFACE_HYPERLINK) {
    const rest = pile.slice(1);
    inplaceShuffle(rest, random);
    pile.splice(1, rest.length, ...rest);
  } else {
    inplaceShuffle(pile, random);
  }
}
