import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBotCorp} from '@/server/automa/IMarsBotCorp';
import {whiteTrackCubes} from '@/server/automa/corps/BaseGameCorps';

// C31 Arclight
export const ARKLIGHT_MARSBOT_CORP: IMarsBotCorp = {
  name: CardName.ARKLIGHT,
  description: 'Tag: Animal. Draft: Animal > Plant. White cubes on plant track. Each Plant or Animal tag resolved (starting tag included) earns 2 MC.',
  tags: [Tag.ANIMAL],
  draftPriority: {type: 'tags', tags: [Tag.ANIMAL, Tag.PLANT]},
  trackCubes: whiteTrackCubes(6),
  effect: {
    // Per tag, so a card with a plant and an animal tag earns 4 M€
    onTagResolved(marsBot, tag) {
      if (tag === Tag.PLANT || tag === Tag.ANIMAL) {
        marsBot.gainMc(2);
        marsBot.game.log('MarsBot (Arclight): Plant/Animal tag, +2 M€');
      }
    },
  },
};
