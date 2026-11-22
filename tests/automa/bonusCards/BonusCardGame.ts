import {BonusCardName} from '@/common/automa/BonusCardName';
import {MarsBot} from '@/server/automa/MarsBot';
import {MarsBotBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCard';

/** Puts every track of MarsBot's board on its last space, so that advancing any of them fails. */
export function maxTracks(marsBot: MarsBot): void {
  for (const track of marsBot.marsBotBoard.tracks) {
    track.position = track.definition.layout.length - 1;
  }
}

/** The names of the bonus cards in MarsBot's bonus deck, draw pile first, then the discards. */
export function bonusCardsInBonusDeck(marsBot: MarsBot): Array<BonusCardName> {
  return [...marsBot.bonusDeck.drawPile, ...marsBot.bonusDeck.discardPile].flatMap((c) => c instanceof MarsBotBonusCard ? [c.name] : []);
}

/** The names of the bonus cards in MarsBot's action deck, undefined for a project card. */
export function bonusCardsInActionDeck(marsBot: MarsBot): Array<BonusCardName | undefined> {
  return marsBot.actionDeck.cards.map((c) => c instanceof MarsBotBonusCard ? c.name : undefined);
}
