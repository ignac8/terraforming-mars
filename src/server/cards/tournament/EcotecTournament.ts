import {Ecotec} from '../prelude2/Ecotec';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {CardResource} from '../../../common/CardResource';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class EcotecTournament extends Ecotec implements ICorporationCard {
  constructor() {
    super({
      name: CardName.ECOTEC_TOURNAMENT,
      tags: [Tag.BUILDING, Tag.MICROBE, Tag.PLANT],
      startingMegaCredits: 48,

      behavior: {
        production: {plants: 1, energy: 1, steel: 1},
      },

      metadata: {
        cardNumber: 'T14',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(48).production((pb) => pb.plants(1).energy(1).steel(1)).br;
          b.effect('When you play a bio tag, including this, gain 1 plant or add a microbe to ANY card.',
            (eb) => eb.tag(Tag.MICROBE).tag(Tag.PLANT).tag(Tag.ANIMAL).startEffect.plants(1).slash().resource(CardResource.MICROBE).asterix());
        }),
        description: 'You start with 48 M€. Increase your plant, energy, and steel production 1 step each.',
      },
    });
  }
}
