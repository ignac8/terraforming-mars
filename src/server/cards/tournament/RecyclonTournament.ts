import {Recyclon} from '../promo/Recyclon';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {CardResource} from '../../../common/CardResource';
import {ICard} from '../ICard';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class RecyclonTournament extends Recyclon implements ICorporationCard {
  constructor() {
    super({
      name: CardName.RECYCLON_TOURNAMENT,
      tags: [Tag.MICROBE, Tag.BUILDING],
      startingMegaCredits: 38,
      resourceType: CardResource.MICROBE,

      behavior: {
        production: {megacredits: -1, plants: 1, energy: 1, heat: 1, steel: 1},
      },

      metadata: {
        cardNumber: 'T09',
        description: 'You start with 38 M€. Decrease your M€ production 1 step and increase your plant, energy, heat, and steel production 1 step each.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(38).nbsp.production((pb) => pb.megacredits(-1).br.plants(1).energy(1).heat(1).steel(1));
          b.corpBox('effect', (ce) => {
            ce.effect('When you play a building tag, including this, FOR EACH building tag on that card, gain 1 microbe to this card, or remove 2 microbes here and raise your plant production 1 step.', (eb) => {
              eb.tag(Tag.BUILDING).colon().resource(CardResource.MICROBE).or();
              eb.resource(CardResource.MICROBE, {amount: 2, digit}).startEffect.production((pb) => pb.plants(1));
            });
          });
        }),
      },
    });
  }

  public override onCardPlayed(player: IPlayer, card: ICard) {
    const buildingTags = player.tags.cardTagCount(card, Tag.BUILDING);
    for (let i = 0; i < buildingTags; i++) {
      player.defer(() => {
        if (this.resourceCount < 2) {
          player.addResourceTo(this, {log: true});
          return undefined;
        }
        const addResource = new SelectOption('Add a microbe resource to this card', 'Add microbe').andThen(() => {
          player.addResourceTo(this, {log: true});
          return undefined;
        });
        const spendResource = new SelectOption('Remove 2 microbes on this card and increase plant production 1 step', 'Remove microbes').andThen(() => {
          player.removeResourceFrom(this, 2);
          player.production.add(Resource.PLANTS, 1, {log: true});
          return undefined;
        });
        return new OrOptions(spendResource, addResource);
      });
    }
    return undefined;
  }
}
