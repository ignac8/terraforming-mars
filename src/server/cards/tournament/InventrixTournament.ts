import {CorporationCard} from '../corporation/CorporationCard';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class InventrixTournament extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.INVENTRIX_TOURNAMENT,
      tags: [Tag.SCIENCE],
      startingMegaCredits: 45,
      globalParameterRequirementBonus: {steps: 2},

      behavior: {
        production: {steel: 2},
        stock: {steel: 4},
      },

      firstAction: {
        text: 'Draw 3 cards',
        drawCard: 3,
      },

      metadata: {
        cardNumber: 'T01',
        description: 'As your first action in the game, draw 3 cards. Start with 45 M€. Increase your steel production 2 steps and gain 4 steel.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(45).nbsp.cards(3).nbsp.production((pb) => pb.steel(2)).steel(4, {digit});
          b.corpBox('effect', (ce) => {
            ce.effect('Your temperature, oxygen, ocean, and Venus requirements are +2 or -2 steps, your choice in each case.', (eb) => {
              eb.plate('Global requirements').startEffect.text('+/- 2');
            });
          });
        }),
      },
    });
  }
}
