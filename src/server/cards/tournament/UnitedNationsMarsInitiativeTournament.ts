import {UnitedNationsMarsInitiative} from '../corporation/UnitedNationsMarsInitiative';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {PlaceCityTile} from '../../deferredActions/PlaceCityTile';
import {PlaceGreeneryTile} from '../../deferredActions/PlaceGreeneryTile';
import {DiscardCards} from '../../deferredActions/DiscardCards';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class UnitedNationsMarsInitiativeTournament extends UnitedNationsMarsInitiative implements ICorporationCard {
  constructor() {
    super({
      name: CardName.UNITED_NATIONS_MARS_INITIATIVE_TOURNAMENT,
      tags: [Tag.EARTH],
      startingMegaCredits: 40,

      metadata: {
        cardNumber: 'T15',
        description: 'You start with 40 M€. Place 1 ocean, 1 city, and 1 greenery tile, collecting no placement bonuses from the map. Discard 3 cards.',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(40).oceans(1).asterix().city().asterix().greenery().asterix().text('-3').cards(1);
          b.corpBox('action', (ce) => {
            ce.action('If your Terraform Rating was raised this generation, you may pay 3 M€ to raise it 1 step more.', (eb) => {
              eb.megacredits(3).startAction.tr(1).asterix();
            });
          });
        }),
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const game = player.game;
    game.defer(new PlaceOceanTile(player, {title: 'Select space for ocean tile (no placement bonus)', grantPlacementBonus: false}));
    game.defer(new PlaceCityTile(player, {title: 'Select space for city tile (no placement bonus)', grantPlacementBonus: false}));
    game.defer(new PlaceGreeneryTile(player, 'greenery', {grantPlacementBonus: false}));
    game.defer(new DiscardCards(player, 3, 3, 'Select 3 cards to discard'));
    return undefined;
  }
}
