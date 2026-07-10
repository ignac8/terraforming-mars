import {Tag} from '../../../common/cards/Tag';
import {CorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class CheungShingMARSTournament extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.CHEUNG_SHING_MARS_TOURNAMENT,
      tags: [Tag.BUILDING],
      startingMegaCredits: 65,

      behavior: {
        production: {megacredits: 3},
      },

      cardDiscount: {tag: Tag.BUILDING, amount: 2},
      metadata: {
        cardNumber: 'T12',
        description: 'You start with 3 M€ production and 65 M€.',
        renderData: CardRenderer.builder((b) => {
          b.br.br;
          b.production((pb) => pb.megacredits(3)).nbsp.megacredits(65);
          b.corpBox('effect', (ce) => {
            ce.effect('When you play a building tag, you pay 2 M€ less for it.', (eb) => {
              eb.tag(Tag.BUILDING).startEffect.megacredits(-2);
            });
          });
        }),
      },
    });
  }
}
