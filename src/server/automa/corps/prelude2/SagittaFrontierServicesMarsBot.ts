import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotCorp} from '@/server/automa/MarsBotCorp';
import {cardTagsIncludingEvent} from '@/server/automa/MarsBotTags';
import {IProjectCard} from '@/server/cards/IProjectCard';

// C44 Sagitta
export class SagittaFrontierServicesMarsBot extends MarsBotCorp {
  constructor() {
    super({
      name: CardName.SAGITTA_FRONTIER_SERVICES,
      description: 'Tags: Power, Event. Setup: +8 MC. Tagless cards pay double the Failed Action (10 MC instead of 5). 1-tag cards earn 1 extra MC.',
      tags: [Tag.POWER, Tag.EVENT],
    });
  }

  public override setup(marsBot: IMarsBot): void {
    marsBot.gainMc(8);
    marsBot.game.log('MarsBot (Sagitta): +8 M€');
  }

  // Tagless card: double the Failed Action (10 MC instead of 5, 6 instead of 3 on Easy). 1-tag card: +1 MC.
  public override onProjectCardResolved(marsBot: IMarsBot, card: IProjectCard): void {
    const tagCount = cardTagsIncludingEvent(card).length;
    if (tagCount === 0) {
      const extra = marsBot.failedActionMc;
      marsBot.gainMc(extra);
      marsBot.game.log('MarsBot (Sagitta): tagless card, Failed Action pays ${0} M€ more', (b) => b.number(extra));
    } else if (tagCount === 1) {
      marsBot.gainMc(1);
      marsBot.game.log('MarsBot (Sagitta): 1-tag card, +1 M€');
    }
  }
}
