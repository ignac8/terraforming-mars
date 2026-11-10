import {BonusCardId} from '@/common/automa/AutomaTypes';
import {Tag} from '@/common/cards/Tag';
import {cardTagsIncludingEvent} from '@/server/automa/MarsBotTags';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {inplaceShuffle} from '@/server/utils/shuffle';

// B30: Interface Hyperlink (Tycho Magnetics): draw 1 card per space of the energy track, at least
// 2, play the 2 best and discard the rest. The card is destroyed once it plays a card.
export const INTERFACE_HYPERLINK_MARSBOT_BONUS_CARD: MarsBotBonusCardEffect = {
  id: BonusCardId.B30_INTERFACE_HYPERLINK,
  resolve(resolver) {
    const marsBotBoard = resolver.turnResolver.marsBotBoard;
    const energyTrack = marsBotBoard.tagToTrack[Tag.POWER];
    const count = Math.max(2, energyTrack === undefined ? 0 : marsBotBoard.tracks[energyTrack].position);
    const drawn = resolver.game.projectDeck.drawN(resolver.game, count);
    if (drawn.length === 0) {
      resolver.game.log('MarsBot resolves Interface Hyperlink: no cards to draw');
      return false;
    }
    // Science cards first, then the most expensive, then the most tags, then at random
    const science = (card: IProjectCard) => cardTagsIncludingEvent(card).includes(Tag.SCIENCE) ? 1 : 0;
    const tagCount = (card: IProjectCard) => cardTagsIncludingEvent(card).length;
    inplaceShuffle(drawn, resolver.game.rng);
    drawn.sort((a, b) => science(b) - science(a) || b.cost - a.cost || tagCount(b) - tagCount(a));
    const discarded = drawn.splice(2);
    resolver.game.projectDeck.discard(...discarded);
    for (const card of drawn) {
      resolver.game.log('MarsBot draws and resolves ${0} (Interface Hyperlink)', (b) => b.card(card));
      resolver.turnResolver.resolveProjectCard(card);
    }
    resolver.game.log('Interface Hyperlink is destroyed');
    return true;
  },
};
