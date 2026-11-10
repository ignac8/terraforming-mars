import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBotCorp} from '@/server/automa/IMarsBotCorp';

// C32 Polyphemos
export const POLYPHEMOS_MARSBOT_CORP: IMarsBotCorp = {
  name: CardName.POLYPHEMOS,
  description: 'Tags: 3 Space, 3 Event. Setup: +25 MC. Each generation: discard the project card with fewest tags from the action deck.',
  tags: [Tag.SPACE, Tag.SPACE, Tag.SPACE, Tag.EVENT, Tag.EVENT, Tag.EVENT],
  setup(marsBot) {
    marsBot.gainMc(25);
    marsBot.game.log('MarsBot (Polyphemos): +25 M€');
  },
  beforeActionPhase(marsBot) {
    marsBot.maybeDiscardProjectCardWithFewestTags();
  },
};
