import {SerializedAutomaState} from '../SerializedGame';
import {Random} from '../../common/utils/Random';
import {inplaceShuffle} from '../utils/shuffle';
import {BonusCardName} from '../../common/automa/BonusCardName';
import {bonusCardNameFromSave} from './legacyBonusCards';

/**
 * Reorders the piles of MarsBot's that no player has seen: its action deck and its bonus deck's draw pile.
 *
 * Tyco Magnetics puts Interface Hyperlink at the bottom of the bonus deck, where everyone knows it is, so a card
 * there stays. The bonus deck draws from the end of its draw pile, so the bottom is the start.
 */
export function shuffleMarsBotHiddenPiles(state: SerializedAutomaState, random: Random): void {
  inplaceShuffle(state.actionDeckCardNames, random);
  // Older saves hold the draw pile under its own key, and bonus cards in older forms
  const pile: Array<string> = state.bonusDeck?.drawPile ?? state.bonusDeckDrawPile ?? [];
  if (pile.length > 0 && bonusCardNameFromSave(pile[0]) === BonusCardName.INTERFACE_HYPERLINK) {
    const rest = pile.slice(1);
    inplaceShuffle(rest, random);
    pile.splice(1, rest.length, ...rest);
  } else {
    inplaceShuffle(pile, random);
  }
}
