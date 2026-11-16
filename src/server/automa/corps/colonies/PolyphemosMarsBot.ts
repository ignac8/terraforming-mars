import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotCorp} from '@/server/automa/MarsBotCorp';

// C32 Polyphemos
export class PolyphemosMarsBot extends MarsBotCorp {
  constructor() {
    super({
      name: CardName.POLYPHEMOS,
      description: 'Tags: 3 Space, 3 Event. Setup: +25 MC. Each generation: discard the project card with fewest tags from the action deck.',
      tags: [Tag.SPACE, Tag.SPACE, Tag.SPACE, Tag.EVENT, Tag.EVENT, Tag.EVENT],
    });
  }

  public override setup(marsBot: IMarsBot): void {
    marsBot.gainMc(25);
    marsBot.game.log('MarsBot (Polyphemos): +25 M€');
  }

  public override beforeActionPhase(marsBot: IMarsBot): void {
    marsBot.maybeDiscardProjectCardWithFewestTags();
  }
}
