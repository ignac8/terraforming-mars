import {IPlayer} from '../IPlayer';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {DeferredAction} from './DeferredAction';
import {PlaceOceanTile} from './PlaceOceanTile';
import {PlaceCityTile} from './PlaceCityTile';
import {PlaceGreeneryTile} from './PlaceGreeneryTile';

export type AnyOrderTile = 'ocean' | 'city' | 'greenery';

const OPTION_TITLES: Record<AnyOrderTile, string> = {
  ocean: 'Place an ocean tile',
  city: 'Place a city tile',
  greenery: 'Place a greenery tile',
};

function placement(player: IPlayer, tile: AnyOrderTile) {
  switch (tile) {
  case 'ocean':
    return new PlaceOceanTile(player, {title: 'Select space for ocean tile (no placement bonus)', grantSpaceBonuses: false});
  case 'city':
    return new PlaceCityTile(player, {title: 'Select space for city tile (no placement bonus)', grantSpaceBonuses: false});
  case 'greenery':
    return new PlaceGreeneryTile(player, 'greenery', {grantSpaceBonuses: false});
  }
}

/**
 * Places several tiles, one at a time, with the player picking which goes next. A card's effects
 * resolve in any order, and with tiles the order matters: a greenery placed before the city can go
 * almost anywhere, one placed after it must go next to it. The placements grant no printed space bonuses.
 */
export class PlaceTilesInAnyOrder extends DeferredAction {
  constructor(player: IPlayer, private readonly tiles: ReadonlyArray<AnyOrderTile>) {
    super(player);
  }

  public execute() {
    const choices = Array.from(new Set(this.tiles));
    if (choices.length === 0) {
      this.cb(undefined);
      return undefined;
    }
    if (choices.length === 1) {
      this.place(choices[0]);
      return undefined;
    }
    return new OrOptions(...choices.map((tile) => new SelectOption(OPTION_TITLES[tile]).andThen(() => {
      this.place(tile);
      return undefined;
    }))).setTitle('Select the next tile to place');
  }

  private place(tile: AnyOrderTile): void {
    const rest = [...this.tiles];
    rest.splice(rest.indexOf(tile), 1);
    const game = this.player.game;
    game.defer(placement(this.player, tile)).andThen(() => {
      game.defer(new PlaceTilesInAnyOrder(this.player, rest).andThen(() => this.cb(undefined)));
    });
  }
}
