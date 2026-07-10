import {Tag} from '../../../common/cards/Tag';
import {CorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class PhoboLogTournament extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.PHOBOLOG_TOURNAMENT,
      tags: [Tag.SPACE],
      startingMegaCredits: 28,

      behavior: {
        stock: {titanium: 10},
        titanumValue: 1,
        production: {plants: 1},
        tr: 1,
      },

      metadata: {
        cardNumber: 'T03',
        description: 'You start with 10 titanium, 28 M€, and 1 plant production. Raise your TR 1 step.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(28).nbsp.titanium(10, {digit}).nbsp.production((pb) => pb.plants(1)).tr(1);
          b.corpBox('effect', (ce) => {
            ce.effect('Your titanium resources are each worth 1 M€ extra.', (eb) => {
              eb.titanium(1).startEffect.plus(Size.SMALL).megacredits(1);
            });
          });
        }),
      },
    });
  }
}
