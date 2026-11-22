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
import {Priority} from '../deferredActions/Priority';
import {message} from '../logs/MessageBuilder';

/**
 * The stock of MarsBot's player, whose resources are its M€ supply.
 *
 * Per rules (page 4):
 * - "Remove" resources → remove from MarsBot's M€ supply
 * - "Steal" resources → take from MarsBot's M€ supply as if they were the resource type
 *
 * A removal deducts M€ from `MarsBot.megacredits`, except that the matching colony storage area
 * (Ceres steel, Triton titanium, Io heat, Callisto energy, Ganymede plants, Luna M€) counts as that
 * resource too (rulebook C, p.5). When a player removes or steals and both the M€ supply and that area hold
 * something, the player chooses the source or splits.
 *
 * Resource additions (from game engine bonuses) are ignored, since MarsBot doesn't use resources.
 */
export class MarsBotStock extends Stock {
  private marsBotRef: MarsBot | undefined;

  public setMarsBot(marsBot: MarsBot): void {
    this.marsBotRef = marsBot;

    // Per automa rules, all MarsBot resources are its M€ supply, plus the colony storage area
    // that holds the resource, plus for plants the ones on Ecoline's or Ecotec's card
    // (rulebook B, p.4 FAQ). Cards check `target.steel > 0` etc. to decide if stealing is possible,
    // and cap the amount by it. MarsBot's scoring never reads these.
    const stock = this;
    for (const resource of ALL_RESOURCES) {
      Object.defineProperty(this, resource, {
        get() {
          return stock.supply + stock.storage(resource) + stock.plantsOnCard(resource);
        },
        set() { /* no-op: MarsBotStock.add() handles mutations via megacredits */ },
        configurable: true,
      });
    }
  }

  /** MarsBot's M€ supply, which is what it spends, before the resource getters add colony storage on top. */
  private get supply(): number {
    return this.marsBotRef?.megacredits ?? 0;
  }

  private storage(resource: Resource): number {
    return this.marsBotRef?.shippingBoard.get(COLONY_STORAGE_FOR_RESOURCE[resource]) ?? 0;
  }

  /** Tells whether MarsBot's M€ supply covers the total of `units`, since it has no separate resource pools. */
  public override has(units: Units): boolean {
    const total = Units.values(units).reduce((a, b) => a + b, 0);
    return (this.marsBotRef?.megacredits ?? 0) >= total;
  }

  /** Tells whether MarsBot's M€ supply can cover the decreases in `units`. */
  public override canAdjust(units: Units): boolean {
    const cost = Units.values(units).reduce((sum, v) => sum + Math.min(0, v), 0);
    return (this.marsBotRef?.megacredits ?? 0) + cost >= 0;
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
      const taker = isFromPlayer(options?.from) && options.from.player !== this.player ? options.from.player : undefined;
      const fromCard = () => {
        const removed = this.takePlantsFromCard(-amount);
        if (options?.log) {
          this.player.game.log('MarsBot loses ${0} plant resources from corp card', (b) => b.number(removed));
        }
        if (taker !== undefined) {
          this.fireRemovalHooks(resource, -removed, taker);
        }
      };
      // A player removing from MarsBot chooses between its M€ supply and the matching colony
      // storage area. Anything else (events, MarsBot itself) comes out of the M€ supply.
      const fromStock = () => {
        if (taker !== undefined && this.storage(resource) > 0) {
          this.removeFromSources(resource, -amount, taker, amount, options, undefined);
        } else {
          this.removeFromSupply(resource, -amount, amount, options);
        }
      };
      if (!this.hasPlantsOnCard(resource)) {
        fromStock();
      } else if (taker !== undefined && this.supply + this.storage(resource) > 0) {
        this.choosePlantSource(taker, 'Remove', -amount, fromCard, fromStock);
      } else {
        fromCard();
      }
    }
    // Positive amounts (resource gains from placement bonuses etc.) are ignored: MarsBot's M€ come
    // from `MarsBotTilePlacer`'s placement calculations.
  }

  /**
   * Moves up to `qty` of `resource` from MarsBot to `thief`, taken from its M€ supply and the matching
   * colony storage area as if they were that resource.
   *
   * Per rules (page 4), the thief takes the resources from MarsBot's M€ supply as if they were the
   * resource type being stolen.
   */
  public override steal(resource: Resource, qty: number, thief: IPlayer, options?: {log?: boolean}): void {
    if (this.marsBotRef === undefined) {
      super.steal(resource, qty, thief, options);
      return;
    }
    const fromCard = () => {
      const stolen = this.takePlantsFromCard(qty);
      thief.stock.add(resource, stolen);
      this.fireRemovalHooks(resource, -stolen, thief);
      if (options?.log) {
        this.player.game.log('${0} steals ${1} plant resources from MarsBot\'s corp card',
          (b) => b.player(thief).number(stolen));
      }
    };
    const fromStock = () => {
      const total = Math.min(this.supply + this.storage(resource), qty);
      if (total <= 0) {
        return;
      }
      // Thief gains the actual resource type (plants, steel, etc.), as much as was left to take
      this.removeFromSources(resource, total, thief, -total, {from: {player: thief}}, (fromStorage, removed) => {
        thief.stock.add(resource, removed);
        if (options?.log) {
          this.player.game.log('${0} steals ${1} ${2} from MarsBot (${3} MC deducted, ${4} from colony storage)',
            (b) => b.player(thief).number(removed).rawString(resource).number(removed - fromStorage).number(fromStorage));
        }
      });
    };
    if (!this.hasPlantsOnCard(resource)) {
      fromStock();
    } else if (this.supply + this.storage(resource) > 0) {
      this.choosePlantSource(thief, 'Steal', qty, fromCard, fromStock);
    } else {
      fromCard();
    }
  }

  /** Counts the plants on Ecoline's or Ecotec's corporation card, which the player's cards can target. */
  private plantsOnCard(resource: Resource): number {
    return resource === Resource.PLANTS ? this.marsBotRef?.getCorpState('plantResources') ?? 0 : 0;
  }

  private hasPlantsOnCard(resource: Resource): boolean {
    return this.plantsOnCard(resource) > 0;
  }

  /**
   * Takes up to `wanted` plants off the corporation card.
   *
   * Returns how many it took. The excess is lost.
   */
  private takePlantsFromCard(wanted: number): number {
    const marsBot = this.marsBotRef;
    if (marsBot === undefined) {
      return 0;
    }
    const plants = marsBot.getCorpState('plantResources');
    const taken = Math.min(wanted, plants);
    marsBot.setCorpState('plantResources', plants - taken);
    return taken;
  }

  /**
   * Lets `taker` choose between the plants on Ecoline's or Ecotec's card and the usual sources.
   *
   * FAQ (rulebook B, p.4): the player may remove or steal the plants on the card, and the excess is
   * lost. The player picks the card or the usual sources, never both: "you can remove either 2mc or
   * that 1 plant" (TDaver, BGG 3341536).
   */
  private choosePlantSource(taker: IPlayer, verb: 'Remove' | 'Steal', wanted: number, fromCard: () => void, fromStock: () => void): void {
    const colony = COLONY_STORAGE_FOR_RESOURCE[Resource.PLANTS];
    // What each source can give, which the labels show
    const fromCardAmount = Math.min(wanted, this.plantsOnCard(Resource.PLANTS));
    const fromStockAmount = Math.min(wanted, this.supply + this.storage(Resource.PLANTS));
    const stockOption = this.storage(Resource.PLANTS) > 0 ?
      message('${0} ${1} from MarsBot\'s M€ supply or its ${2} colony storage', (b) => b.rawString(verb).number(fromStockAmount).rawString(colony)) :
      message('${0} ${1} from MarsBot\'s M€ supply', (b) => b.rawString(verb).number(fromStockAmount));
    taker.defer(() => new OrOptions(
      new SelectOption(message('${0} ${1} plants from MarsBot\'s corporation card (the rest is lost)', (b) => b.rawString(verb).number(fromCardAmount)))
        .andThen(() => {
          fromCard();
          return undefined;
        }),
      new SelectOption(stockOption).andThen(() => {
        fromStock();
        return undefined;
      }),
    ).setTitle(message('${0} ${1} plants from MarsBot', (b) => b.rawString(verb).number(wanted))), Priority.BEFORE_OPPONENT_TRIGGER);
  }

  /**
   * Removes up to `wanted` of `resource` from MarsBot on behalf of `taker`, from the M€ supply and
   * the colony storage area that holds `resource`.
   *
   * The taker picks the source when it matters (BGG 3599965 and 3398852 allow either, and mixing
   * within one removal). `hookAmount` is what Law Suit and Crash Site Cleanup are told was removed.
   * `done` gets the amount that came from storage and the amount actually removed, once the choice
   * is made. It may run later, after the taker answers, when another removal may have emptied the
   * supply or the area since.
   */
  private removeFromSources(
    resource: Resource,
    wanted: number,
    taker: IPlayer,
    hookAmount: number,
    options: {log?: boolean, from?: From} | undefined,
    done: ((fromStorage: number, removed: number) => void) | undefined,
  ): void {
    const supply = this.supply;
    const storage = this.storage(resource);
    const total = Math.min(wanted, supply + storage);
    // The storage part must make up what the supply cannot cover, and cannot exceed either bound.
    const lo = Math.max(0, total - supply);
    const hi = Math.min(total, storage);
    const apply = (chosenFromStorage: number) => {
      // What is left now, which an earlier queued removal may have cut down
      const fromStorage = Math.min(chosenFromStorage, this.storage(resource));
      const fromSupply = Math.min(total - chosenFromStorage, this.supply);
      this.removeFromSupply(resource, total - chosenFromStorage, hookAmount, options, chosenFromStorage);
      done?.(fromStorage, fromSupply + fromStorage);
    };
    if (lo === hi) {
      apply(lo);
      return;
    }

    const colony = COLONY_STORAGE_FOR_RESOURCE[resource];
    // One field for how many come from storage, starting at the most; the rest comes from M€
    taker.defer(() => new SelectAmount(
      message('Take ${0} ${1} from MarsBot: how many from its ${2} colony storage? The rest comes from its M€ supply',
        (b) => b.number(total).rawString(resource).rawString(colony)),
      'Take', lo, hi, true)
      .andThen((fromStorage) => {
        apply(fromStorage);
        return undefined;
      }), Priority.BEFORE_OPPONENT_TRIGGER);
  }

  /**
   * Takes `amount - fromStorage` out of the M€ supply (never below 0) and `fromStorage` out of the
   * colony storage area, then fires the hooks `Stock.add()` normally fires.
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
    const mc = Math.min(amount, marsBot.megacredits);
    marsBot.megacredits -= mc;
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
      this.fireRemovalHooks(resource, hookAmount, from.player);
    }
  }

  /** Tells Law Suit and Crash Site Cleanup that `remover` took `-amount` of `resource` from MarsBot. */
  private fireRemovalHooks(resource: Resource, amount: number, remover: IPlayer): void {
    LawSuit.resourceHook(this.player, amount, remover);
    CrashSiteCleanup.resourceHook(this.player, resource, amount, remover);
  }
}

/**
 * The production of MarsBot's player, where a decrease regresses the matching track.
 *
 * Per rules (page 4-5): "Decrease" production → regress corresponding track.
 * Production increases are ignored, since MarsBot doesn't produce.
 */
export class MarsBotProduction extends Production {
  private marsBotRef: MarsBot | undefined;

  public setMarsBot(marsBot: MarsBot): void {
    this.marsBotRef = marsBot;

    const resourceToTrack = new Map<Resource, number>();
    for (let i = 0; i < marsBot.marsBotBoard.definitions.length; i++) {
      for (const res of marsBot.marsBotBoard.definitions[i].productions) {
        resourceToTrack.set(res, i);
      }
    }

    // A track's position reads as its production, so MarsBot is a legal target for a production
    // decrease only while the matching track can regress (position > 0).
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
      // Increases are ignored, and so is any change before `setMarsBot`
      return;
    }

    for (let i = 0; i < -amount; i++) {
      this.marsBotRef.regressTrack(resource);
    }
  }
}
