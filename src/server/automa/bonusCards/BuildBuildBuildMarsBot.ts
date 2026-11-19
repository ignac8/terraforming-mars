import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBonusCardEffect} from '@/server/automa/bonusCards/MarsBotBonusCardEffect';
import {loseMc} from '@/server/automa/bonusCards/bonusCardHelpers';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';
import {inplaceShuffle} from '@/server/utils/shuffle';

/**
 * The special tile each project card MarsBot can play shows, for Build, Build, Build (B27).
 *
 * Capital and New Holland are left out: their tiles are cities, and a city can't go next to the
 * player's city.
 */
const SPECIAL_TILES: ReadonlyMap<CardName, TileType> = new Map([
  [CardName.COMMERCIAL_DISTRICT, TileType.COMMERCIAL_DISTRICT],
  [CardName.ECOLOGICAL_ZONE, TileType.ECOLOGICAL_ZONE],
  [CardName.INDUSTRIAL_CENTER, TileType.INDUSTRIAL_CENTER],
  [CardName.LAVA_FLOWS, TileType.LAVA_FLOWS],
  [CardName.MINING_AREA, TileType.MINING_AREA],
  [CardName.MINING_RIGHTS, TileType.MINING_RIGHTS],
  [CardName.MOHOLE_AREA, TileType.MOHOLE_AREA],
  [CardName.NATURAL_PRESERVE, TileType.NATURAL_PRESERVE],
  [CardName.NUCLEAR_ZONE, TileType.NUCLEAR_ZONE],
  [CardName.RESTRICTED_AREA, TileType.RESTRICTED_AREA],
  [CardName.DEIMOS_DOWN_PROMO, TileType.DEIMOS_DOWN],
  [CardName.GREAT_DAM_PROMO, TileType.GREAT_DAM],
  [CardName.MAGNETIC_FIELD_GENERATORS_PROMO, TileType.MAGNETIC_FIELD_GENERATORS],
]);

// Philares: a. a city next to the player's greenery, then lose 5 M€; b. the special tile of a
// card MarsBot played next to the player's city, then lose that card and 3 M€; c. gain 3 M€
// and shuffle this card back into the bonus deck
export class BuildBuildBuildMarsBot extends MarsBotBonusCardEffect {
  constructor() {
    super({id: BonusCardId.B27_BUILD_BUILD_BUILD});
  }

  public override resolve(marsBot: IMarsBot, card: MarsBotBonusCard): boolean {
    const tilePlacer = new MarsBotTilePlacer(marsBot);
    const citySpace = tilePlacer.findCitySpaceNextToHumanGreenery();
    if (citySpace !== undefined) {
      marsBot.game.addCity(marsBot.player, citySpace);
      marsBot.gainMc(tilePlacer.getTotalPlacementMC(citySpace));
      const lost = loseMc(marsBot, 5);
      marsBot.game.log('MarsBot resolves Build Build Build: city next to the player\'s greenery, loses ${0} M€', (b) => b.number(lost));
      return false;
    }

    const played = marsBot.playedProjectCards.find((c) => SPECIAL_TILES.has(c.name));
    const tileType = played === undefined ? undefined : SPECIAL_TILES.get(played.name);
    const specialSpace = tileType === undefined ? undefined : tilePlacer.findSpecialTileSpaceNextToHumanCity();
    if (played !== undefined && tileType !== undefined && specialSpace !== undefined) {
      marsBot.game.addTile(marsBot.player, specialSpace, {tileType, card: played.name});
      marsBot.gainMc(tilePlacer.getTotalPlacementMC(specialSpace));
      marsBot.removePlayedProjectCard(played);
      const lost = loseMc(marsBot, 3);
      marsBot.game.log('MarsBot resolves Build Build Build: ${0} tile next to the player\'s city, removes the card and loses ${1} M€',
        (b) => b.card(played).number(lost));
      return false;
    }

    marsBot.gainMc(3);
    marsBot.bonusDeck.drawPile.push(card);
    inplaceShuffle(marsBot.bonusDeck.drawPile, marsBot.game.rng);
    marsBot.game.log('MarsBot resolves Build Build Build: +3 M€, card shuffled back into the bonus deck');
    return true;
  }
}
