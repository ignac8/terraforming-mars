import {SagittaFrontierServices} from '../prelude2/SagittaFrontierServices';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../ICard';

export class SagittaFrontierServicesTournament extends SagittaFrontierServices implements ICorporationCard {
  constructor() {
    super({
      name: CardName.SAGITTA_FRONTIER_SERVICES_TOURNAMENT,
      tags: [Tag.PLANT, Tag.BUILDING],
      startingMegaCredits: 35,

      behavior: {
        production: {energy: 1, plants: 1, megacredits: 4},
      },

      metadata: {
        cardNumber: 'T02',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(35).production((pb) => pb.energy(1).plants(1).megacredits(4)).cards(1, {secondaryTag: AltSecondaryTag.NO_TAGS}).br;
          b.effect('When you play a card with no tags, gain 4 M€. When you play a card with EXACTLY 1 TAG, you gain 1 M€.', (eb) => eb.noTags().startEffect.megacredits(4)).br;
          b.effect(undefined, (eb) => eb.emptyTag().asterix().startEffect.megacredits(1));
        }),
        description: 'You start with 35 M€. Increase your energy and plant production 1 step each, and your M€ production 4 steps. Draw a card that has no tag.',
      },
    });
  }

  public override onCardPlayed(player: IPlayer, card: ICard) {
    // Unlike the original, the tournament card has no 'including this' clause:
    // the 4 M€ for its own no-tag play are folded into the 35 starting M€.
    if (card === this) {
      return;
    }
    super.onCardPlayed(player, card);
  }
}
