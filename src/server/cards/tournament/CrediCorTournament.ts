import {CrediCor} from '../corporation/CrediCor';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class CrediCorTournament extends CrediCor implements ICorporationCard {
  constructor() {
    super({
      name: CardName.CREDICOR_TOURNAMENT,
      startingMegaCredits: 57,

      behavior: {
        production: {steel: 1, heat: 2},
        stock: {heat: 2},
      },

      metadata: {
        cardNumber: 'T04',
        description: 'You start with 57 M€, 1 steel production, and 2 heat production. Gain 2 heat.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(57).nbsp.production((pb) => pb.steel(1).heat(2)).heat(2);
          b.corpBox('effect', (ce) => {
            ce.effect('After you pay for a card or standard project with a basic cost of 20M€ or more, you gain 4 M€.', (eb) => {
              eb.minus().megacredits(20).startEffect.megacredits(4);
            });
          });
        }),
      },
    });
  }
}
