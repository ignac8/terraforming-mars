import {InterplanetaryCinematics} from '../corporation/InterplanetaryCinematics';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class InterplanetaryCinematicsTournament extends InterplanetaryCinematics implements ICorporationCard {
  constructor() {
    super({
      name: CardName.INTERPLANETARY_CINEMATICS_TOURNAMENT,
      tags: [Tag.MICROBE, Tag.BUILDING, Tag.BUILDING],
      startingMegaCredits: 30,

      behavior: {
        stock: {steel: 20, plants: 2},
        production: {energy: 1, plants: 1},
      },

      metadata: {
        cardNumber: 'T10',
        description: 'You start with 20 steel, 2 plants, and 30 M€. Increase your energy and plant production 1 step each.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(30).nbsp.steel(20, {digit}).plants(2).br;
          b.production((pb) => pb.energy(1).plants(1)).br;
          b.corpBox('effect', (ce) => {
            ce.effect('Each time you play an event, you gain 2 M€.', (eb) => {
              eb.tag(Tag.EVENT).startEffect.megacredits(2);
            });
          });
        }),
      },
    });
  }
}
