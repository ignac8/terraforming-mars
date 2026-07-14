import {CorporationCard} from '../corporation/CorporationCard';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class EcoLineTournament extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.ECOLINE_TOURNAMENT,
      tags: [Tag.PLANT],
      startingMegaCredits: 36,

      behavior: {
        production: {plants: 2, megacredits: 1, steel: 1, titanium: 1},
        stock: {plants: 3},
        greeneryDiscount: 1,
      },

      metadata: {
        cardNumber: 'T07',
        description: 'You start with 2 plant production, 3 plants, and 36 M€. Increase your M€, steel, and titanium production 1 step each.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.production((pb) => pb.plants(2).megacredits(1).steel(1).titanium(1)).br;
          b.megacredits(36).plants(3, {digit}).br;
          b.corpBox('effect', (ce) => {
            ce.effect('You may always pay 7 plants, instead of 8, to place greenery.', (eb) => {
              eb.plants(7, {digit}).startAction.greenery();
            });
          });
        }),
      },
    });
  }
}
