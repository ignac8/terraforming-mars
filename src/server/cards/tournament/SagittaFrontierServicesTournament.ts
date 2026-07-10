import {SagittaFrontierServices} from '../prelude2/SagittaFrontierServices';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class SagittaFrontierServicesTournament extends SagittaFrontierServices implements ICorporationCard {
  constructor() {
    super({
      name: CardName.SAGITTA_FRONTIER_SERVICES_TOURNAMENT,
      startingMegaCredits: 31,

      behavior: {
        production: {energy: 1, plants: 1, megacredits: 4},
      },

      metadata: {
        cardNumber: 'T02',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(31).production((pb) => pb.energy(1).plants(1).megacredits(4)).cards(1, {secondaryTag: AltSecondaryTag.NO_TAGS}).br;
          b.effect('When you play a card with no tags, including this, gain 4 M€.', (eb) => eb.noTags().startEffect.megacredits(4)).br;
          b.effect('When you play a card with EXACTLY 1 TAG, you gain 1 M€.', (eb) => eb.emptyTag().asterix().startEffect.megacredits(1)).br;
        }),
        description: 'You start with 31 M€. Increase your energy and plant production 1 step each, and your M€ production 4 steps. Draw a card that has no tag.',
      },
    });
  }
}
