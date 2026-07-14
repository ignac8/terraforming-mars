import {CorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class NirgalEnterprisesTournament extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.NIRGAL_ENTERPRISES_TOURNAMENT,
      tags: [Tag.PLANT, Tag.POWER, Tag.BUILDING, Tag.BUILDING],
      startingMegaCredits: 30,

      behavior: {
        production: {energy: 1, plants: 1, steel: 1, heat: 3},
        stock: {heat: 3},
      },

      metadata: {
        cardNumber: 'T08',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(30).production((pb) => pb.energy(1).plants(1).steel(1).heat(3, {digit})).br;
          b.heat(3, {digit}).br;
          b.effect('AWARDS AND MILESTONES ALWAYS COST 0 M€ FOR YOU.', (eb) => {
            eb.plate('Awards and Milestones').startEffect.megacredits(1, {text: '0'});
          });
        }),
        description: 'You start with 30 M€. Increase your energy, plant, and steel production 1 step each, and your heat production 3 steps. Gain 3 heat.',
      },
    });
  }
}
