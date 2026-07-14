import {UtopiaInvest} from '../turmoil/UtopiaInvest';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class UtopiaInvestTournament extends UtopiaInvest implements ICorporationCard {
  constructor() {
    super({
      name: CardName.UTOPIA_INVEST_TOURNAMENT,
      tags: [Tag.POWER, Tag.BUILDING],
      startingMegaCredits: 40,

      behavior: {
        production: {steel: 1, titanium: 1, energy: 2},
        stock: {steel: 4},
      },

      metadata: {
        cardNumber: 'T16',
        description: 'You start with 40 M€. Increase your steel and titanium production 1 step each, and your energy production 2 steps. Gain 4 steel.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(40).nbsp.production((pb) => pb.steel(1).titanium(1).energy(2)).steel(4, {digit});
          b.corpBox('action', (ce) => {
            ce.action('Decrease any production to gain 4 resources of that kind.', (eb) => {
              eb.production((eb) => eb.wild(1)).startAction.wild(4, {digit});
            });
          });
        }),
      },
    });
  }
}
