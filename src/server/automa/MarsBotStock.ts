import {Stock} from '../player/Stock';
import {Production} from '../player/Production';
import {ALL_RESOURCES, Resource} from '../../common/Resource';
import {Units} from '../../common/Units';
import {IPlayer} from '../IPlayer';
import {From, isFromPlayer} from '../logs/From';
import {MarsBot} from './MarsBot';
import {CrashSiteCleanup} from '../cards/promo/CrashSiteCleanup';
import {LawSuit} from '../cards/promo/LawSuit';
import {COLONY_STORAGE_FOR_RESOURCE} from './colonies/MarsBotShippingBoard';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {SelectAmount} from '../inputs/SelectAmount';
import {PlayerInput} from '../PlayerInput';
import {Priority} from '../deferredActions/Priority';
import {message} from '../logs/MessageBuilder';

/**
 * Override Stock for MarsBot's player.
 *
 * Per rules (page 4):
 * - "Remove" resources → remove from MarsBot's MC supply
 * - "Steal" resources → take from MarsBot's MC supply as if they were the resource type
 *
 * All resource removals are converted to MC deductions from megacredits, except that the
 * matching colony storage area (Ceres steel, Triton titanium, Io heat, Callisto energy,
 * Ganymede plants, Luna M€) counts as that resource too (C-25). When a player removes or steals
 * and both the MC supply and that area hold something, the player chooses the source or splits.
 * Resource additions (from game engine bonuses) are ignored since MarsBot
 * doesn't use resources — MC is tracked separately in turnResolver.megacredits.
 */
export class MarsBotStock extends Stock {
  private marsBotRef: MarsBot | undefined;

  public setMarsBot(marsBot: MarsBot): void {
    this.marsBotRef = marsBot;

    // Per automa rules, all MarsBot resources are its MC supply, plus the colony storage area
    // that holds the resource (C-25). Cards check target.steel > 0 etc. to decide if stealing
    // is possible.
    const stock = this;
    for (const resource of ALL_RESOURCES) {
      Object.defineProperty(this, resource, {
        get() {
          return stock.supply + stock.storage(resource);
        },
        set() { /* no-op: MarsBotStock.add() handles mutations via megacredits */ },
        configurable: true,
      });
    }
  }

  /** MarsBot's MC supply, which is what it spends. The resource getters add colony storage on top. */
  private get supply(): number {
    return this.marsBotRef?.turnResolver.megacredits ?? 0;
  }

  private storage(resource: Resource): number {
    return this.marsBotRef?.shippingBoard.get(COLONY_STORAGE_FOR_RESOURCE[resource]) ?? 0;
  }

  /** MarsBot has megacredits, not separate resource pools. */
  public override has(units: Units): boolean {
    const total = Units.values(units).reduce((a, b) => a + b, 0);
    return (this.marsBotRef?.turnResolver.megacredits ?? 0) >= total;
  }

  /** MarsBot can adjust if megacredits can cover the total cost. */
  public override canAdjust(units: Units): boolean {
    const cost = Units.values(units).reduce((sum, v) => sum + Math.min(0, v), 0);
    return (this.marsBotRef?.turnResolver.megacredits ?? 0) + cost >= 0;
  }

  public override add(
    resource: Resource,
    amount: number,
    options?: {log?: boolean, from?: From, stealing?: boolean},
  ) {
    if (this.marsBotRef === undefined) {
      // Before MarsBot is wired up, fall through to normal behavior
      super.add(resource, amount, options);
      return;
    }

    if (amount < 0) {
      // Ecoline/Ecotec FAQ: plants on corp card can be targeted. Excess is lost, NOT from MC supply.
      if (resource === Resource.PLANTS && this.marsBotRef.corpSpecificState.has('plantResources')) {
        const plantResources = this.marsBotRef.corpSpecificState.get('plantResources') ?? 0;
        if (plantResources > 0) {
          const removed = Math.min(-amount, plantResources);
          this.marsBotRef.corpSpecificState.set('plantResources', plantResources - removed);
          if (options?.log) {
            this.player.game.log('MarsBot loses ${0} plant resources from corp card',
              (b) => b.number(removed));
          }
          return; // Plants from corp card — excess is lost, NOT from MC supply
        }
      }

      // A player removing from MarsBot chooses between its MC supply and the matching colony
      // storage area (C-25). Anything else (events, MarsBot itself) comes out of the MC supply.
      const taker = isFromPlayer(options?.from) && options.from.player !== this.player ? options.from.player : undefined;
      if (taker !== undefined && this.storage(resource) > 0) {
        this.removeFromSources(resource, -amount, taker, amount, options, undefined);
        return;
      }
      this.removeFromSupply(resource, -amount, amount, options);
    }
    // Positive amounts (resource gains from placement bonuses etc.) are ignored
    // MarsBot gets MC from turnResolver.megacredits via tile placement calculations
  }

  /**
   * Override steal: use megacredits instead of actual resource count.
   * Per rules: "you may take the resources from MarsBot's MC supply
   * as if they were the resource type you are stealing."
   */
  public override steal(resource: Resource, qty: number, thief: IPlayer, options?: {log?: boolean}): void {
    if (this.marsBotRef === undefined) {
      super.steal(resource, qty, thief, options);
      return;
    }
    // Ecoline/Ecotec FAQ: plants on the corp card can be stolen. Excess is lost, NOT taken from MC supply.
    const plantResources = this.marsBotRef.getCorpState('plantResources');
    if (resource === Resource.PLANTS && plantResources > 0) {
      const stolen = Math.min(qty, plantResources);
      this.marsBotRef.setCorpState('plantResources', plantResources - stolen);
      thief.stock.add(resource, stolen);
      if (options?.log) {
        this.player.game.log('${0} steals ${1} plant resources from MarsBot\'s corp card',
          (b) => b.player(thief).number(stolen));
      }
      return;
    }
    const total = Math.min(this.supply + this.storage(resource), qty);
    if (total <= 0) {
      return;
    }
    // Thief gains the actual resource type (plants, steel, etc.)
    this.removeFromSources(resource, total, thief, -total, {from: {player: thief}}, (fromStorage) => {
      thief.stock.add(resource, total);
      if (options?.log) {
        this.player.game.log('${0} steals ${1} ${2} from MarsBot (${3} MC deducted, ${4} from colony storage)',
          (b) => b.player(thief).number(total).rawString(resource).number(total - fromStorage).number(fromStorage));
      }
    });
  }

  /**
   * Remove up to `wanted` of `resource` from MarsBot on behalf of `taker`, from the MC supply and
   * the colony storage area that holds `resource`. The taker picks the source when it matters
   * (BGG 3599965 and 3398852 allow either, and mixing within one removal). `hookAmount` is what
   * Law Suit and Crash Site Cleanup are told was removed. `done` gets the amount that came from
   * storage, once the choice is made. It may run later, after the taker answers.
   */
  private removeFromSources(
    resource: Resource,
    wanted: number,
    taker: IPlayer,
    hookAmount: number,
    options: {log?: boolean, from?: From} | undefined,
    done: ((fromStorage: number) => void) | undefined,
  ): void {
    const supply = this.supply;
    const storage = this.storage(resource);
    const total = Math.min(wanted, supply + storage);
    // The storage part must make up what the supply cannot cover, and cannot exceed either bound.
    const lo = Math.max(0, total - supply);
    const hi = Math.min(total, storage);
    const apply = (fromStorage: number) => {
      this.removeFromSupply(resource, total - fromStorage, hookAmount, options, fromStorage);
      done?.(fromStorage);
    };
    if (lo === hi) {
      apply(lo);
      return;
    }

    const colony = COLONY_STORAGE_FOR_RESOURCE[resource];
    const choices: Array<PlayerInput> = [];
    if (lo === 0) {
      choices.push(new SelectOption(message('Take ${0} from MarsBot\'s M€ supply', (b) => b.number(total)))
        .andThen(() => {
          apply(0);
          return undefined;
        }));
    }
    if (hi === total) {
      choices.push(new SelectOption(message('Take ${0} from MarsBot\'s ${1} colony storage', (b) => b.number(total).rawString(colony)))
        .andThen(() => {
          apply(total);
          return undefined;
        }));
    }
    const splitMin = Math.max(1, lo);
    const splitMax = Math.min(total - 1, hi);
    if (splitMin === splitMax) {
      choices.push(new SelectOption(message('Take ${0} from MarsBot\'s ${1} colony storage and ${2} from its M€ supply',
        (b) => b.number(splitMin).rawString(colony).number(total - splitMin)))
        .andThen(() => {
          apply(splitMin);
          return undefined;
        }));
    } else if (splitMin < splitMax) {
      choices.push(new SelectAmount(
        message('Take how many from MarsBot\'s ${0} colony storage? The rest comes from its M€ supply', (b) => b.rawString(colony)),
        'Take', splitMin, splitMax)
        .andThen((fromStorage) => {
          apply(fromStorage);
          return undefined;
        }));
    }
    taker.defer(() => new OrOptions(...choices).setTitle(
      message('Take ${0} ${1} from MarsBot', (b) => b.number(total).rawString(resource))), Priority.BEFORE_OPPONENT_TRIGGER);
  }

  /**
   * Take `amount - fromStorage` out of the MC supply (never below 0), and `fromStorage` out of
   * the colony storage area, then fire the hooks Stock.add() normally fires (bypassed by this
   * override).
   */
  public removeFromSupply(
    resource: Resource,
    amount: number,
    hookAmount: number,
    options?: {log?: boolean, from?: From},
    fromStorage: number = 0,
  ): void {
    const marsBot = this.marsBotRef;
    if (marsBot === undefined) {
      return;
    }
    const mc = Math.min(amount, marsBot.turnResolver.megacredits);
    marsBot.turnResolver.megacredits -= mc;
    if (fromStorage > 0) {
      marsBot.shippingBoard.spend(COLONY_STORAGE_FOR_RESOURCE[resource], fromStorage);
    }

    if (options?.log) {
      this.player.game.log('MarsBot loses ${0} MC (${1} removed)',
        (b) => b.number(mc).rawString(resource));
      if (fromStorage > 0) {
        this.player.game.log('MarsBot loses ${0} ${1} from its ${2} colony storage',
          (b) => b.number(fromStorage).rawString(resource).rawString(COLONY_STORAGE_FOR_RESOURCE[resource]));
      }
    }

    const from = options?.from;
    if (isFromPlayer(from)) {
      LawSuit.resourceHook(this.player, hookAmount, from.player);
      CrashSiteCleanup.resourceHook(this.player, resource, hookAmount, from.player);
    }
  }
}

/**
 * Override Production for MarsBot's player.
 *
 * Per rules (page 4-5): "Decrease" production → regress corresponding track.
 * Production increases are ignored (MarsBot doesn't produce).
 */
export class MarsBotProduction extends Production {
  private marsBotRef: MarsBot | undefined;

  public setMarsBot(marsBot: MarsBot): void {
    this.marsBotRef = marsBot;

    // Precompute resource -> track index mapping.
    const resourceToTrack = new Map<Resource, number>();
    for (let i = 0; i < marsBot.marsBotBoard.definitions.length; i++) {
      for (const res of marsBot.marsBotBoard.definitions[i].productions) {
        resourceToTrack.set(res, i);
      }
    }

    // Report track position as production so canHaveProductionReduced() works correctly.
    // Per automa rules, production decrease regresses the corresponding track.
    // MarsBot is targetable only if the mapped track has room to regress (position > 0).
    for (const resource of ALL_RESOURCES) {
      const trackIndex = resourceToTrack.get(resource);
      Object.defineProperty(this, resource, {
        get: () => {
          if (trackIndex === undefined || this.marsBotRef === undefined) {
            return 0;
          }
          return this.marsBotRef.marsBotBoard.tracks[trackIndex].position;
        },
        set() { /* no-op */ },
        configurable: true,
      });
    }
  }

  public override add(
    resource: Resource,
    amount: number,
    _options?: {log: boolean, from?: From, stealing?: boolean},
  ) {
    if (this.marsBotRef === undefined || amount >= 0) {
      // Ignore production increases; before wiring, fall through
      return;
    }

    // Production decrease → regress corresponding track
    for (let i = 0; i < -amount; i++) {
      this.marsBotRef.regressTrack(resource);
    }
  }
}
