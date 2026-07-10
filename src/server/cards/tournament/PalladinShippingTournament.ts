import {PalladinShipping} from '../prelude2/PalladinShipping';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {digit} from '../Options';
import {Size} from '../../../common/cards/render/Size';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class PalladinShippingTournament extends PalladinShipping implements ICorporationCard {
  constructor() {
    super({
      name: CardName.PALLADIN_SHIPPING_TOURNAMENT,
      tags: [Tag.SPACE],
      startingMegaCredits: 36,

      behavior: {
        stock: {titanium: 5},
        production: {megacredits: 1},
        drawCard: 3,
      },

      metadata: {
        cardNumber: 'T13',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(36).titanium(5, {digit}).production((pb) => pb.megacredits(1)).cards(3).br;
          b.corpBox('effect-action', (cea) => {
            cea.vSpace(Size.LARGE);
            cea.effect('When you play a space event, gain 1 titanium.', (eb) => {
              eb.tag(Tag.SPACE).tag(Tag.EVENT).startEffect.titanium(1);
            });
            b.br;
            cea.action('Spend 2 titanium to raise the temperature 1 step.', (ab) => {
              ab.titanium(2).startAction.temperature(1);
            });
          });
        }),
        description: 'You start with 36 M€ and 1 M€ production. Gain 5 titanium. Draw 3 cards.',
      },
    });
  }
}
