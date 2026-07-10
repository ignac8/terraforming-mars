import {Factorum} from '../promo/Factorum';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class FactorumTournament extends Factorum implements ICorporationCard {
  constructor() {
    super({
      name: CardName.FACTORUM_TOURNAMENT,
      tags: [Tag.POWER, Tag.BUILDING],
      startingMegaCredits: 40,

      behavior: {
        production: {steel: 1, megacredits: 4},
      },

      metadata: {
        cardNumber: 'T06',
        description: 'You start with 40 M€. Increase your steel production 1 step and your M€ production 4 steps.',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(40).nbsp.production((pb) => pb.steel(1).megacredits(4));
          b.corpBox('action', (ce) => {
            ce.vSpace(Size.LARGE);
            ce.action('Increase your energy production 1 step IF YOU HAVE NO ENERGY RESOURCES, or spend 3M€ to draw a building card.', (eb) => {
              eb.empty().arrow().production((pb) => pb.energy(1)).asterix();
              eb.or().megacredits(3).startAction.cards(1, {secondaryTag: Tag.BUILDING});
            });
          });
        }),
      },
    });
  }
}
