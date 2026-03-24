import {Stock} from '../player/Stock';
import {Production} from '../player/Production';
import {Resource} from '../../common/Resource';
import {IPlayer} from '../IPlayer';
import {From} from '../logs/From';
import {MarsBot} from './MarsBot';

/**
 * Override Stock for MarsBot's player.
 *
 * Per rules (page 4):
 * - "Remove" resources → remove from MarsBot's MC supply
 * - "Steal" resources → take from MarsBot's MC supply as if they were the resource type
 *
 * All resource removals are converted to MC deductions from mcSupply.
 * Resource additions (from game engine bonuses) are ignored since MarsBot
 * doesn't use resources — MC is tracked separately in turnResolver.mcSupply.
 */
export class MarsBotStock extends Stock {
  private marsBotRef: MarsBot | undefined;

  constructor(player: IPlayer) {
    super(player);
  }

  public setMarsBot(marsBot: MarsBot): void {
    this.marsBotRef = marsBot;
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
      // Resources being removed/stolen → deduct from MC supply
      const mc = Math.min(-amount, this.marsBotRef.turnResolver.mcSupply);
      this.marsBotRef.turnResolver.mcSupply -= mc;

      if (options?.stealing && options.from !== undefined) {
        // Thief gets MC as if it were the resource type
        // The steal() method in Stock will call thief.stock.add() separately
      }

      if (options?.log) {
        this.player.game.log('MarsBot loses ${0} MC (${1} removed)',
          (b) => b.number(mc).rawString(resource));
      }
    }
    // Positive amounts (resource gains from placement bonuses etc.) are ignored
    // MarsBot gets MC from turnResolver.mcSupply via tile placement calculations
  }

  /**
   * Override steal: use mcSupply instead of actual resource count.
   * Per rules: "you may take the resources from MarsBot's MC supply
   * as if they were the resource type you are stealing."
   */
  public override steal(resource: Resource, qty: number, thief: IPlayer, options?: {log?: boolean}): void {
    if (this.marsBotRef === undefined) {
      super.steal(resource, qty, thief, options);
      return;
    }
    const qtyToSteal = Math.min(this.marsBotRef.turnResolver.mcSupply, qty);
    if (qtyToSteal > 0) {
      this.marsBotRef.turnResolver.mcSupply -= qtyToSteal;
      // Thief gains the actual resource type (plants, steel, etc.)
      thief.stock.add(resource, qtyToSteal);
      if (options?.log) {
        this.player.game.log('${0} steals ${1} ${2} from MarsBot (${3} MC deducted)',
          (b) => b.player(thief).number(qtyToSteal).rawString(resource).number(qtyToSteal));
      }
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

  constructor(player: IPlayer) {
    super(player);
  }

  public setMarsBot(marsBot: MarsBot): void {
    this.marsBotRef = marsBot;
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

    // Production decrease → regress track
    const productionMap: Record<Resource, string> = {
      [Resource.STEEL]: 'Steel',
      [Resource.TITANIUM]: 'Titanium',
      [Resource.MEGACREDITS]: 'MC',
      [Resource.ENERGY]: 'Electricity',
      [Resource.HEAT]: 'Heat',
      [Resource.PLANTS]: 'Plants',
    };

    const productionType = productionMap[resource];
    if (productionType) {
      for (let i = 0; i < -amount; i++) {
        this.marsBotRef.regressTrack(productionType);
      }
    }
  }
}
