import {ColonyName} from '../../../common/colonies/ColonyName';
import {Tag} from '../../../common/cards/Tag';
import type {MarsBot} from '../MarsBot';

/**
 * Maps each colony tile to the Tag of the MarsBot track that its resource type advances.
 * undefined means the colony is exempt from C-12 overflow (Titan = floaters, exempt per C-23)
 * or has no storage at all (Europa, C-24d).
 *
 * Track-to-tag mapping for Tharsis:
 *   Building(0)=BUILDING, Space(1)=SPACE, Event(2)=EVENT, Science(3)=SCIENCE,
 *   Energy(4)=POWER, Earth(5)=EARTH, Plant(6)=PLANT
 *
 * C-25: Resources on Ceres/Luna/Io/Enceladus/Ganymede/Callisto/Miranda/Triton are considered
 * resources of the indicated type for player-card purposes.
 */
export const COLONY_STORAGE_TAG: Partial<Record<ColonyName, Tag>> = {
  [ColonyName.CERES]: Tag.BUILDING,   // Steel → Building track
  [ColonyName.LUNA]: Tag.EVENT,        // Megacredits → Event (credits) track
  [ColonyName.IO]: Tag.EARTH,          // Heat → Earth track
  [ColonyName.ENCELADUS]: Tag.PLANT,  // Microbes → Plant track (biome resource)
  [ColonyName.GANYMEDE]: Tag.PLANT,   // Plants → Plant track
  [ColonyName.CALLISTO]: Tag.POWER,   // Energy → Energy track
  [ColonyName.MIRANDA]: Tag.PLANT,    // Animals → Plant track (biome resource)
  [ColonyName.TRITON]: Tag.SPACE,     // Titanium → Space track
  // Titan: floaters — exempt from C-12 (C-23); no entry here, handled in add()
  // Europa: no storage (C-24d); no entry here, handled in add()
  [ColonyName.PLUTO]: Tag.EVENT,      // Card-equivalent (C-26) → MC → Event track
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
   * Does NOT apply to Titan (checked in add() before calling this).
   */
  private checkOverflow(colonyName: ColonyName, marsBot: MarsBot): void {
    const tag = COLONY_STORAGE_TAG[colonyName];
    if (tag === undefined) {
      return;
    } // No track mapping — no overflow

    while ((this.storage.get(colonyName) ?? 0) >= 5) {
      const current = this.storage.get(colonyName) ?? 0;
      this.storage.set(colonyName, current - 5);
      const trackIndex = marsBot.board.getTrackIndexForTag(tag);
      if (trackIndex !== undefined) {
        marsBot.turnResolver.advanceTrack(trackIndex);
      }
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
