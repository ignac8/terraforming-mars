import {ColonyName} from '../../../common/colonies/ColonyName';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import type {MarsBot} from '../MarsBot';

/**
 * Maps each colony tile to the Tag of the MarsBot track that its resource type advances.
 * undefined means the colony is exempt from C-12 overflow (Titan = floaters, exempt per C-23)
 * or has no storage at all (Europa, C-24d).
 *
 * The tags are the ones printed on each storage area of the Shipping Board. The track a tag
 * advances depends on the map (on Vastitas Borealis, microbes advance the Science track).
 *
 * C-25: Resources on Ceres/Luna/Io/Enceladus/Ganymede/Callisto/Miranda/Triton are considered
 * resources of the indicated type for player-card purposes.
 */
export const COLONY_STORAGE_TAG: Partial<Record<ColonyName, Tag>> = {
  [ColonyName.CERES]: Tag.BUILDING,   // Steel
  [ColonyName.LUNA]: Tag.EVENT,       // Megacredits
  [ColonyName.IO]: Tag.EARTH,         // Heat
  [ColonyName.ENCELADUS]: Tag.MICROBE,
  [ColonyName.GANYMEDE]: Tag.PLANT,
  [ColonyName.CALLISTO]: Tag.POWER,   // Energy
  [ColonyName.MIRANDA]: Tag.ANIMAL,
  [ColonyName.TRITON]: Tag.SPACE,     // Titanium
  // Titan: floaters, exempt from C-12 (C-23); no entry here, handled in add()
  // Europa: no storage (C-24d); no entry here, handled in add()
  [ColonyName.PLUTO]: Tag.SCIENCE,    // Cards (C-26)
};

/**
 * The storage area that holds each standard resource for the player's steal and remove effects
 * (C-25). Mirrors the resource printed on each area: Ceres steel, Triton titanium, Io heat,
 * Callisto energy, Ganymede plants, Luna M€.
 */
export const COLONY_STORAGE_FOR_RESOURCE: Record<Resource, ColonyName> = {
  [Resource.MEGACREDITS]: ColonyName.LUNA,
  [Resource.STEEL]: ColonyName.CERES,
  [Resource.TITANIUM]: ColonyName.TRITON,
  [Resource.PLANTS]: ColonyName.GANYMEDE,
  [Resource.ENERGY]: ColonyName.CALLISTO,
  [Resource.HEAT]: ColonyName.IO,
};

/**
 * MarsBot's Shipping Board (C-18): 11 storage areas, one per colony tile.
 *
 * Key rules:
 *   C-12: When any storage area reaches ≥5 resources, remove 5 and advance the
 *         indicated track by 1. Loops if still ≥5 after removal. Does NOT apply to Titan.
 *   C-24d: Resources are never placed in Europa's storage area.
 *   C-23: Titan storage is only used without Venus Next (for floaters, C-14).
 */
export class MarsBotShippingBoard {
  public storage: Map<ColonyName, number> = new Map();

  /**
   * Add `amount` resources to a colony's storage area.
   * Triggers C-12 overflow check (automatically advances track if ≥5 accumulated).
   *
   * Note: Europa is silently ignored (C-24d). Titan is stored but exempt from overflow (C-23).
   */
  public add(colonyName: ColonyName, amount: number, marsBot: MarsBot): void {
    // C-24d: No resources ever placed in Europa's storage area
    if (colonyName === ColonyName.EUROPA) {
      return;
    }

    const current = this.storage.get(colonyName) ?? 0;
    this.storage.set(colonyName, current + amount);

    // C-23: Titan/Floater area is exempt from C-12 overflow
    if (colonyName === ColonyName.TITAN) {
      return;
    }

    this.checkOverflow(colonyName, marsBot);
  }

  /**
   * C-12: While ≥5 resources in the storage area, remove 5 and advance the indicated track.
   * Does NOT apply to Titan (checked in add() before calling this), nor once the game is decided.
   */
  private checkOverflow(colonyName: ColonyName, marsBot: MarsBot): void {
    const tag = COLONY_STORAGE_TAG[colonyName];
    if (tag === undefined || marsBot.game.isDoneWithFinalProduction()) {
      return;
    } // No track mapping or the game is decided — no overflow

    while ((this.storage.get(colonyName) ?? 0) >= 5) {
      const current = this.storage.get(colonyName) ?? 0;
      this.storage.set(colonyName, current - 5);
      // Not "resolving a tag" for MarsBot's corp (BGG thread 3535330), but a microbe advance
      // still resolves the player's Pharmacy Union or Splice (rulebook B, p.4 FAQ)
      marsBot.turnResolver.advanceTrackOfTag(tag);
    }
  }

  /**
   * Spend (remove) resources from a storage area without triggering overflow.
   * Used for floater spending (C-9): deduct from Titan storage.
   * Does not go below 0.
   */
  public spend(colonyName: ColonyName, amount: number): void {
    const current = this.storage.get(colonyName) ?? 0;
    this.storage.set(colonyName, Math.max(0, current - amount));
  }

  /** Get the current storage amount for a colony tile. */
  public get(colonyName: ColonyName): number {
    return this.storage.get(colonyName) ?? 0;
  }

  public serialize(): Record<string, number> {
    return Object.fromEntries(this.storage);
  }

  public restoreState(data: Record<string, number>): void {
    this.storage = new Map(Object.entries(data).map(([k, v]) => [k as ColonyName, v as number]));
  }
}
