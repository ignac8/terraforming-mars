import {Manutech} from '../venusNext/Manutech';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class ManutechTournament extends Manutech implements ICorporationCard {
  constructor() {
    super({
      name: CardName.MANUTECH_TOURNAMENT,
      tags: [Tag.BUILDING],
      startingMegaCredits: 35,

      behavior: {
        production: {steel: 1, plants: 1},
        city: {},
      },

      metadata: {
        cardNumber: 'T11',
        description: 'You start with 1 steel production, 1 plant production, and 35 M€. Place a city tile.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.production((pb) => pb.steel(1).plants(1)).nbsp.megacredits(35).city();
          b.corpBox('effect', (ce) => {
            ce.effect('For each step you increase the production of a resource, including this, you also gain that resource.', (eb) => {
              eb.production((pb) => pb.wild(1)).startEffect.wild(1);
            });
          });
        }),
      },
    });
  }
}
