/**
 * A deliberately simple, deterministic scripted player for MarsBot simulations.
 *
 * It answers every PlayerInput the engine asks the human for with an InputResponse,
 * using a greedy "value in M€" heuristic. It is not a strong player: it never plans
 * more than one action ahead, never holds cards for combos, and values cards from
 * their printed production, TR, tiles and VP only. Results produced with it describe
 * how this strategy fares against MarsBot, not how a person would.
 */
import {IPlayer} from '../../src/server/IPlayer';
import {PlayerInput} from '../../src/server/PlayerInput';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {Payment} from '../../src/common/inputs/Payment';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {SelectAmount} from '../../src/server/inputs/SelectAmount';
import {SelectPayment} from '../../src/server/inputs/SelectPayment';
import {SelectProjectCardToPlay} from '../../src/server/inputs/SelectProjectCardToPlay';
import {SelectStandardProjectToPlay} from '../../src/server/inputs/SelectStandardProjectToPlay';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {SelectProductionToLose} from '../../src/server/inputs/SelectProductionToLose';
import {SelectResource} from '../../src/server/inputs/SelectResource';
import {SelectResources} from '../../src/server/inputs/SelectResources';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {SelectDelegate} from '../../src/server/inputs/SelectDelegate';
import {SelectGlobalEvent} from '../../src/server/inputs/SelectGlobalEvent';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {ICard, isIActionCard} from '../../src/server/cards/ICard';
import {IStandardProjectCard} from '../../src/server/cards/IStandardProjectCard';
import {ICorporationCard} from '../../src/server/cards/corporation/ICorporationCard';
import {Tag} from '../../src/common/cards/Tag';
import {CardType} from '../../src/common/cards/CardType';
import {CardName} from '../../src/common/cards/CardName';
import {Units} from '../../src/common/Units';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Phase} from '../../src/common/Phase';
import {MAX_OCEAN_TILES, MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MIN_TEMPERATURE} from '../../src/common/constants';
import {IAward} from '../../src/server/awards/IAward';
import {Message} from '../../src/common/logs/Message';
import {Counter} from '../../src/server/behavior/Counter';
import {Countable} from '../../src/server/behavior/Countable';

const TOTAL_STEPS = (MAX_TEMPERATURE - MIN_TEMPERATURE) / 2 + MAX_OXYGEN_LEVEL + MAX_OCEAN_TILES;

/** M€-equivalent value of one unit of production per remaining generation. */
const PRODUCTION_VALUE: Units = {megacredits: 1, steel: 1.5, titanium: 2.2, plants: 1.6, energy: 0.8, heat: 0.7};
/** M€-equivalent value of one unit of a resource gained immediately. */
const STOCK_VALUE: Units = {megacredits: 1, steel: 2, titanium: 3, plants: 1.2, energy: 0.8, heat: 0.5};

function titleText(title: string | Message): string {
  return typeof title === 'string' ? title : title.message;
}

function numeric(x: unknown): number {
  return typeof x === 'number' ? x : 0;
}

/** Tunable knobs of the script. */
export type Strategy = {
  /** Buy a card when its estimated value exceeds cost + 3 M€ by more than this. */
  buyThreshold: number,
  /** Play a card when its value minus cost exceeds this (engine phase). */
  playThreshold: number,
  /** M€ kept back from standard projects while more than 3 generations remain. */
  standardProjectReserve: number,
  /** Scales how much future production is worth. */
  productionWeight: number,
  /** Maximum hand size the script will buy into. */
  maxHand: number,
  /** Base M€ value of a city tile (adjacency, Mayor), on top of its income. */
  cityValue: number,
  /** Take a standard project only when its value minus cost exceeds this. */
  standardProjectThreshold: number,
  /** Generations before the estimated end when awards may be funded. */
  awardWindow: number,
  /** Penalty per MarsBot city next to a greenery we place. */
  feedBotCityPenalty: number,
  /** Extra M€ value per terraforming step, for strategies that rush the game end. */
  rushBonus: number,
  /** M€ value spread over the last steps toward Mayor, Gardener or Builder. 0 disables. */
  milestoneChase: number,
};

export const DEFAULT_STRATEGY: Strategy = {
  buyThreshold: 5,
  playThreshold: -8,
  standardProjectReserve: 0,
  productionWeight: 1,
  maxHand: 10,
  cityValue: 5,
  standardProjectThreshold: -4,
  awardWindow: 4,
  feedBotCityPenalty: 2,
  rushBonus: 10,
  milestoneChase: 12,
};

export class ScriptedPlayer {
  /** Counts of fallbacks taken, for diagnosing gaps in the script. */
  public readonly stats = {inputs: 0, errors: 0, fallbacks: 0, cardsPlayed: 0, standardProjects: 0, cardsBought: 0};

  constructor(
    public readonly player: IPlayer,
    private readonly corporation: CardName,
    protected readonly strategy: Strategy = DEFAULT_STRATEGY) {}

  protected get game() {
    return this.player.game;
  }

  private get marsBot(): IPlayer | undefined {
    return this.game.automaHooks?.marsBotPlayer;
  }

  // ---- Game-state estimates ----

  /** Remaining global-parameter steps until Mars is terraformed. */
  public remainingSteps(): number {
    const temp = (MAX_TEMPERATURE - this.game.getTemperature()) / 2;
    const oxygen = MAX_OXYGEN_LEVEL - this.game.getOxygenLevel();
    const oceans = MAX_OCEAN_TILES - this.game.board.getOceanSpaces().length;
    return temp + oxygen + oceans;
  }

  /** Global-parameter steps raised per generation so far, blended with a prior of 3.5. */
  private stepsPerGeneration(): number {
    const done = TOTAL_STEPS - this.remainingSteps();
    const gens = Math.max(0, this.game.generation - 1);
    return (done + 3.5 * 2) / (gens + 2);
  }

  /** Estimated generations left, including the current one. */
  public generationsLeft(): number {
    return Math.max(1, Math.ceil(this.remainingSteps() / this.stepsPerGeneration()));
  }

  /**
   * Generations until the card's requirements are likely met: 0 if met now,
   * Infinity if they will probably never be met in time (or can no longer be).
   */
  public requirementDelay(card: IProjectCard): number {
    const game = this.game;
    const rate = Math.max(0.8, this.stepsPerGeneration() / 3);
    let delay = 0;
    for (const req of card.requirements) {
      const max = req.max === true;
      let gap = 0;
      if (req.temperature !== undefined) {
        gap = (req.temperature - game.getTemperature()) / 2;
      } else if (req.oxygen !== undefined) {
        gap = req.oxygen - game.getOxygenLevel();
      } else if (req.oceans !== undefined) {
        gap = req.oceans - game.board.getOceanSpaces().length;
      } else if (req.tag !== undefined) {
        const have = this.player.tags.count(req.tag, 'raw');
        const need = req.count ?? 1;
        if (!max && have < need) {
          delay = Math.max(delay, (need - have) * 2);
        } else if (max && have > need) {
          return Infinity;
        }
        continue;
      } else {
        // Production, TR, tile and other requirements: assume a couple of generations if unmet.
        continue;
      }
      if (max) {
        if (gap < 0) {
          return Infinity; // window already closed
        }
      } else if (gap > 0) {
        delay = Math.max(delay, gap / rate);
      }
    }
    return delay;
  }

  /**
   * Extra M€ value of one more city, greenery or building tag when it brings an unclaimed
   * milestone (Mayor, Gardener, Builder) within reach. A milestone is worth 5 VP for 8 M€.
   */
  private milestoneBonus(kind: 'Mayor' | 'Gardener' | 'Builder'): number {
    const game = this.game;
    if (game.allMilestonesClaimed() || this.strategy.milestoneChase === 0) {
      return 0;
    }
    const milestone = game.milestones.find((m) => m.name === kind);
    if (milestone === undefined || game.claimedMilestones.some((c) => c.milestone === milestone)) {
      return 0;
    }
    const threshold = (milestone as unknown as {threshold?: number}).threshold ?? 0;
    const gap = threshold - milestone.getScore(this.player);
    if (gap <= 0 || gap > 3) {
      return 0;
    }
    return this.strategy.milestoneChase / gap;
  }

  /** True when the card lowers a production (other than M€) that we don't have. */
  private lacksProductionToLose(card: IProjectCard): boolean {
    const production = card.behavior?.production;
    if (production === undefined) {
      return false;
    }
    return Units.keys.some((key) => {
      const delta = production[key];
      return key !== 'megacredits' && typeof delta === 'number' && delta < 0 && this.player.production[key] + delta < 0;
    });
  }

  /** Generations until the first "max" requirement of the card stops being met. */
  private requirementDelayUntilClosed(card: IProjectCard): number {
    const game = this.game;
    const rate = Math.max(0.8, this.stepsPerGeneration() / 3);
    let closes = Infinity;
    for (const req of card.requirements) {
      if (req.max !== true) {
        continue;
      }
      let room = Infinity;
      if (req.temperature !== undefined) {
        room = (req.temperature - game.getTemperature()) / 2;
      } else if (req.oxygen !== undefined) {
        room = req.oxygen - game.getOxygenLevel();
      } else if (req.oceans !== undefined) {
        room = req.oceans - game.board.getOceanSpaces().length;
      }
      closes = Math.min(closes, room / rate);
    }
    return closes;
  }

  /** True once Mars is (nearly) terraformed, so this generation is almost certainly the last. */
  private isLastGeneration(): boolean {
    return this.remainingSteps() <= 2;
  }

  private trValue(gensLeft: number): number {
    // 1 TR = 1 VP at the end, plus 1 M€ income each remaining generation.
    return 5 + Math.max(0, gensLeft - 1) + this.strategy.rushBonus;
  }

  private vpValue(gensLeft: number): number {
    // VP are worth more once the engine phase is over.
    return gensLeft <= 3 ? 7 : 5;
  }

  /** Estimated value in M€ of playing `card` `delay` generations from now, before paying for it. */
  public cardValue(card: IProjectCard, delay: number = 0): number {
    const player = this.player;
    const gensLeft = this.generationsLeft() - Math.ceil(delay);
    if (gensLeft <= 0) {
      return -Infinity;
    }
    // Production pays out at the next production phase onwards.
    const payouts = Math.max(0, gensLeft - 1);
    let value = 0;

    const behavior = card.behavior;
    const counter = new Counter(player, card);
    const count = (x: unknown): number => {
      if (typeof x === 'number') {
        return x;
      }
      if (x === undefined || x === null || typeof x !== 'object') {
        return 0;
      }
      try {
        return counter.count(x as Countable);
      } catch {
        return 0;
      }
    };
    const box = card.productionBox?.(player);
    const production: Partial<Record<keyof Units, unknown>> =
      box !== undefined && Units.keys.some((k) => box[k] !== 0) ? box : behavior?.production ?? {};
    for (const key of Units.keys) {
      value += count(production[key]) * PRODUCTION_VALUE[key] * payouts * this.strategy.productionWeight;
    }
    if (behavior?.stock !== undefined) {
      for (const key of Units.keys) {
        value += count(behavior.stock[key]) * STOCK_VALUE[key];
      }
    }
    if (behavior?.drawCard !== undefined) {
      value += 3 * (typeof behavior.drawCard === 'number' ? behavior.drawCard : numeric(behavior.drawCard.count));
    }
    if (behavior?.city !== undefined) {
      value += this.strategy.cityValue + Math.min(gensLeft, 6) + this.milestoneBonus('Mayor');
    }
    if (behavior?.greenery !== undefined) {
      value += this.milestoneBonus('Gardener');
    }
    if (card.tags.includes(Tag.BUILDING)) {
      value += this.milestoneBonus('Builder');
    }

    const tr = card.computeTr?.(player) ?? card.tr;
    let trSteps: number;
    if (tr !== undefined) {
      trSteps = numeric(tr.tr) + numeric(tr.temperature) + numeric(tr.oxygen) + numeric(tr.oceans) + numeric(tr.venus);
    } else {
      // Read terraforming straight from the declarative behavior. Steps past a maxed parameter give no TR.
      const game = this.game;
      const tempSteps = Math.min(numeric(behavior?.global?.temperature), Math.max(0, (MAX_TEMPERATURE - game.getTemperature()) / 2));
      const oxygenSteps = Math.min(numeric(behavior?.global?.oxygen) + (behavior?.greenery !== undefined ? 1 : 0),
        MAX_OXYGEN_LEVEL - game.getOxygenLevel());
      const oceanSteps = behavior?.ocean !== undefined ?
        Math.min(behavior.ocean.count ?? 1, MAX_OCEAN_TILES - game.board.getOceanSpaces().length) : 0;
      trSteps = Math.max(0, tempSteps) + Math.max(0, oxygenSteps) + oceanSteps + count(behavior?.tr);
    }
    value += trSteps * this.trValue(gensLeft);
    if (behavior?.greenery !== undefined) {
      value += this.vpValue(gensLeft); // the greenery tile itself
    }

    const vp = card.victoryPoints;
    if (typeof vp === 'number') {
      value += vp * this.vpValue(gensLeft);
    } else if (vp !== undefined) {
      // Resource-based or special VP: grows slowly over the remaining game.
      value += Math.min(3, gensLeft / 3) * this.vpValue(gensLeft);
    }

    if (isIActionCard(card)) {
      value += Math.min(gensLeft, 8);
    } else if (card.type === CardType.ACTIVE) {
      // Effect cards: small ongoing benefit.
      value += Math.min(gensLeft, 8) * 0.75;
    }
    // Tags feed milestones, awards and discounts a little.
    value += 0.5 * card.tags.length;

    if (value === 0) {
      // Cards with custom play logic the heuristic cannot read: treat as roughly fair.
      value = card.cost + 2;
    }
    return value;
  }

  /** Value minus cost of playing the card now. */
  private cardScore(card: IProjectCard): number {
    return this.cardValue(card) - this.player.getCardCost(card);
  }

  /** Value minus cost of a card in hand, allowing for waiting until its requirements are met. */
  private futureCardScore(card: IProjectCard): number {
    const delay = this.requirementDelay(card);
    if (delay === Infinity || this.lacksProductionToLose(card)) {
      return -Infinity;
    }
    // A max requirement that is about to close is a trap.
    if (card.requirements.some((r) => r.max === true) && this.requirementDelayUntilClosed(card) < 1.5) {
      return -Infinity;
    }
    return this.cardValue(card, delay) - this.player.getCardCost(card) - 1.5 * delay;
  }

  // ---- Payment ----

  /** Pays `cost` with titanium, then steel, then M€ (then heat for Helion). Returns undefined if unaffordable. */
  public buildPayment(cost: number, options: {steel?: boolean, titanium?: boolean}): Payment | undefined {
    const player = this.player;
    const payment = {...Payment.EMPTY};
    let remaining = cost;

    const spend = (key: 'steel' | 'titanium', available: number, unitValue: number) => {
      if (remaining <= 0 || available <= 0) {
        return;
      }
      let units = Math.min(available, Math.floor(remaining / unitValue));
      remaining -= units * unitValue;
      // Overpay with one more unit rather than spend scarce M€, when that covers the rest.
      if (remaining > 0 && units < available && remaining > player.megaCredits - 5) {
        units++;
        remaining = Math.max(0, remaining - unitValue);
      }
      payment[key] = units;
    };
    if (options.titanium) {
      spend('titanium', player.titanium, player.getTitaniumValue());
    }
    if (options.steel) {
      spend('steel', player.steel, player.getSteelValue());
    }
    const mc = Math.min(remaining, player.megaCredits);
    payment.megacredits = mc;
    remaining -= mc;
    if (remaining > 0 && player.canUseHeatAsMegaCredits) {
      const heat = Math.min(remaining, player.availableHeat());
      payment.heat = heat;
      remaining -= heat;
    }
    return remaining > 0 ? undefined : payment;
  }

  private cardPayment(card: IProjectCard): Payment | undefined {
    return this.buildPayment(this.player.getCardCost(card), {
      steel: card.tags.includes(Tag.BUILDING),
      titanium: card.tags.includes(Tag.SPACE),
    });
  }

  // ---- Entry point ----

  /** Build a response to `input`. */
  public respond(input: PlayerInput): InputResponse {
    this.stats.inputs++;
    if (input instanceof SelectInitialCards) {
      return this.respondInitialCards(input);
    }
    if (input instanceof OrOptions) {
      if (this.isMainActionMenu(input)) {
        return this.respondMainAction(input);
      }
      return this.respondOr(input);
    }
    if (input instanceof AndOptions) {
      return {type: 'and', responses: input.options.map((o) => this.respond(o))};
    }
    if (input instanceof SelectOption) {
      return {type: 'option'};
    }
    if (input instanceof SelectCard) {
      return this.respondSelectCard(input);
    }
    if (input instanceof SelectSpace) {
      return {type: 'space', spaceId: this.chooseSpace(input).id};
    }
    if (input instanceof SelectPlayer) {
      return {type: 'player', player: this.choosePlayer(input).color};
    }
    if (input instanceof SelectAmount) {
      return {type: 'amount', amount: input.max};
    }
    if (input instanceof SelectPayment) {
      const payment = this.buildPayment(input.amount, {steel: input.paymentOptions.steel, titanium: input.paymentOptions.titanium});
      return {type: 'payment', payment: payment ?? {...Payment.EMPTY, megacredits: input.amount}};
    }
    if (input instanceof SelectProjectCardToPlay) {
      return this.respondPlayCard(input) ?? this.fail('no affordable card in SelectProjectCardToPlay');
    }
    if (input instanceof SelectStandardProjectToPlay) {
      return this.bestStandardProject(input)?.response ?? this.fail('no affordable standard project');
    }
    if (input instanceof SelectProductionToLose) {
      return {type: 'productionToLose', units: this.productionToLose(input.unitsToLose)};
    }
    if (input instanceof SelectResource) {
      return {type: 'resource', resource: input.include.includes('megacredits') ? 'megacredits' : input.include[0]};
    }
    if (input instanceof SelectResources) {
      return {type: 'resources', units: {...Units.EMPTY, megacredits: input.count}};
    }
    if (input instanceof SelectColony) {
      return {type: 'colony', colonyName: input.colonies[0].name};
    }
    if (input instanceof SelectParty) {
      return {type: 'party', partyName: input.parties[0]};
    }
    if (input instanceof SelectDelegate) {
      const first = input.players[0];
      return {type: 'delegate', player: first === 'NEUTRAL' ? 'NEUTRAL' : first.color};
    }
    if (input instanceof SelectGlobalEvent) {
      return {type: 'globalEvent', globalEventName: input.globalEvents[0].name};
    }
    return this.fail(`unsupported input ${input.constructor.name}`);
  }

  private fail(reason: string): never {
    throw new Error(`ScriptedPlayer: ${reason}`);
  }

  // ---- Setup ----

  private respondInitialCards(input: SelectInitialCards): InputResponse {
    const responses: Array<InputResponse> = [];
    let startingMc = 42;
    for (const option of input.options) {
      if (option === input.inputs.corp) {
        const corp = (option as SelectCard<ICorporationCard>).cards.find((c) => c.name === this.corporation);
        if (corp === undefined) {
          this.fail(`corporation ${this.corporation} not dealt`);
        }
        startingMc = corp.startingMegaCredits;
        responses.push({type: 'card', cards: [corp.name]});
      } else if (option === input.inputs.project) {
        const cards = (option as SelectCard<IProjectCard>).cards;
        // Keep cards worth their 3 M€, leaving 15 M€ to play them.
        const budget = Math.max(0, Math.floor((startingMc - 15) / 3));
        const keep = this.cardsWorthBuying(cards, budget);
        responses.push({type: 'card', cards: keep.map((c) => c.name)});
      } else {
        responses.push(this.respond(option));
      }
    }
    return {type: 'initialCards', responses};
  }

  /** Picks up to `max` cards whose value clearly exceeds their cost plus the 3 M€ purchase price. */
  private cardsWorthBuying(cards: ReadonlyArray<IProjectCard>, max: number): Array<IProjectCard> {
    const handFull = this.player.cardsInHand.length >= this.strategy.maxHand;
    if (handFull) {
      return [];
    }
    return cards
      .map((card) => ({card, score: this.futureCardScore(card) - 3}))
      .filter((e) => e.score > this.strategy.buyThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((e) => e.card);
  }

  // ---- Generic inputs ----

  private respondOr(input: OrOptions): InputResponse {
    // Final greenery, card choices etc.: take the first option that is not an explicit no-op.
    const isNoop = (o: PlayerInput) => /^(don't|do not|skip|pass|none)/i.test(titleText(o.title).trim());
    let index = input.options.findIndex((o) => !isNoop(o));
    if (index === -1) {
      index = 0;
    }
    // Options can fail to build (e.g. nothing affordable); fall through to the next one.
    for (let i = 0; i < input.options.length; i++) {
      const idx = (index + i) % input.options.length;
      try {
        return {type: 'or', index: idx, response: this.respond(input.options[idx])};
      } catch {
        this.stats.fallbacks++;
      }
    }
    return this.fail('no OrOptions branch could be answered');
  }

  private respondSelectCard(input: SelectCard<ICard>): InputResponse {
    const {min, max} = input.config;
    if (this.game.phase === Phase.RESEARCH || titleText(input.title).includes('to buy')) {
      const affordable = Math.floor(this.player.spendableMegacredits() / this.player.cardCost);
      const reserve = this.generationsLeft() > 2 ? 1 : 0;
      const budget = Math.max(0, Math.min(max, affordable - reserve));
      const keep = this.cardsWorthBuying(input.cards as ReadonlyArray<IProjectCard>, budget);
      this.stats.cardsBought += keep.length;
      return {type: 'card', cards: keep.map((c) => c.name)};
    }
    if (input.config.selectBlueCardAction) {
      return {type: 'card', cards: [input.cards[0].name]};
    }
    // Resource-holding cards: prefer ones that score VP from their resources.
    const ranked = [...input.cards].sort((a, b) => Number(b.victoryPoints !== undefined) - Number(a.victoryPoints !== undefined));
    const count = Math.min(input.cards.length, Math.max(min, Math.min(1, max)));
    return {type: 'card', cards: ranked.slice(0, count).map((c) => c.name)};
  }

  private choosePlayer(input: SelectPlayer): IPlayer {
    const title = titleText(input.title).toLowerCase();
    const beneficial = /gain|add|increase|receive/.test(title) && !/decrease|remove|lose|steal/.test(title);
    if (beneficial) {
      return input.players.find((p) => p === this.player) ?? input.players[0];
    }
    return input.players.find((p) => p !== this.player) ?? input.players[0];
  }

  private productionToLose(count: number): Units {
    const units = {...Units.EMPTY};
    const production = this.player.production;
    let remaining = count;
    for (const key of ['heat', 'energy', 'plants', 'steel', 'titanium', 'megacredits'] as const) {
      const floor = key === 'megacredits' ? -5 : 0;
      const take = Math.min(remaining, production[key] - floor);
      if (take > 0) {
        units[key] = take;
        remaining -= take;
      }
    }
    return units;
  }

  // ---- Tile placement ----

  private chooseSpace(input: SelectSpace): Space {
    const title = titleText(input.title).toLowerCase();
    const board = this.game.board;
    const kind = title.includes('greenery') || title.includes('plants into') ? 'greenery' :
      title.includes('city') ? 'city' :
        title.includes('ocean') ? 'ocean' : 'other';
    let best = input.spaces[0];
    let bestScore = -Infinity;
    for (const space of input.spaces) {
      let score = 0;
      for (const bonus of space.bonus) {
        score += bonus === SpaceBonus.DRAW_CARD ? 3 : bonus === SpaceBonus.TITANIUM ? 3 : bonus === SpaceBonus.STEEL ? 2 : 1.5;
      }
      for (const adj of board.getAdjacentSpaces(space)) {
        if (Board.isOceanSpace(adj)) {
          score += 2;
        }
        const mine = adj.player === this.player;
        if (kind === 'greenery' && mine && Board.isCitySpace(adj)) {
          score += 4;
        }
        if (kind === 'city' && Board.isGreenerySpace(adj)) {
          score += mine ? 3 : 2;
        }
        if (kind === 'city' && adj.tile === undefined && adj.spaceType !== undefined && !Board.isOceanSpace(adj)) {
          score += 0.5; // room for own greeneries later
        }
        if (kind === 'greenery' && adj.player !== undefined && adj.player !== this.player && Board.isCitySpace(adj)) {
          score -= this.strategy.feedBotCityPenalty; // don't feed MarsBot's cities
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = space;
      }
    }
    return best;
  }

  // ---- Main action menu ----

  private isMainActionMenu(input: OrOptions): boolean {
    const t = titleText(input.title);
    return t === 'Take your first action' || t === 'Take your next action';
  }

  protected respondMainAction(menu: OrOptions): InputResponse {
    const find = (pred: (o: PlayerInput) => boolean) => menu.options.findIndex(pred);
    const pick = (index: number, response: InputResponse): InputResponse => ({type: 'or', index, response});

    // 1. Claim a milestone (8 M€ for 5 VP is always worth it).
    const milestone = find((o) => titleText(o.title) === 'Claim a milestone');
    if (milestone >= 0 && this.player.canAfford(8)) {
      return pick(milestone, this.respondOr(menu.options[milestone] as OrOptions));
    }

    // 2. Plants into greenery.
    const plants = find((o) => o instanceof SelectSpace && titleText(o.title).includes('plants into greenery'));
    if (plants >= 0) {
      return pick(plants, this.respond(menu.options[plants]));
    }

    // 3. Heat into temperature, while it still raises it.
    const heat = find((o) => titleText(o.title) === 'Convert 8 heat into temperature' && o.eligibleForDefault !== false);
    if (heat >= 0 && this.game.getTemperature() < MAX_TEMPERATURE) {
      return pick(heat, {type: 'option'});
    }

    // 4. Fund an award we are clearly winning.
    const award = this.chooseAward(menu);
    if (award !== undefined) {
      return award;
    }

    // 5. Use a blue card action; most turn spare resources into something.
    const actionIdx = find((o) => o instanceof SelectCard && o.config.selectBlueCardAction === true);
    if (actionIdx >= 0) {
      return pick(actionIdx, this.respond(menu.options[actionIdx]));
    }

    // 6. Play the best card in hand or standard project, whichever is worth more.
    const playIdx = find((o) => o instanceof SelectProjectCardToPlay);
    const card = playIdx >= 0 ? this.bestCardToPlay(menu.options[playIdx] as SelectProjectCardToPlay) : undefined;
    const spIdx = find((o) => o instanceof SelectStandardProjectToPlay);
    const project = spIdx >= 0 ? this.bestStandardProject(menu.options[spIdx] as SelectStandardProjectToPlay) : undefined;
    if (card !== undefined && (project === undefined || card.score >= project.score)) {
      this.stats.cardsPlayed++;
      return pick(playIdx, card.response);
    }
    if (project !== undefined) {
      this.stats.standardProjects++;
      return pick(spIdx, project.response);
    }

    // 8. Last generation: sell unplayable cards for M€ is not worth a whole action; just pass.
    const pass = find((o) => titleText(o.title) === 'Pass for this generation');
    if (pass >= 0) {
      return pick(pass, {type: 'option'});
    }
    const endTurn = find((o) => titleText(o.title) === 'End Turn');
    if (endTurn >= 0) {
      return pick(endTurn, {type: 'option'});
    }
    return this.fail('no pass option in main menu');
  }

  /**
   * Every reasonable move from the main action menu, for players that search instead of
   * following the greedy order. Cards are limited to the `maxCards` best by heuristic score.
   */
  public mainActionCandidates(menu: OrOptions, maxCards: number): Array<{label: string, response: InputResponse}> {
    const out: Array<{label: string, response: InputResponse}> = [];
    const wrap = (index: number, response: InputResponse): InputResponse => ({type: 'or', index, response});
    menu.options.forEach((option, index) => {
      const title = titleText(option.title);
      try {
        if (title === 'Claim a milestone' && option instanceof OrOptions && this.player.canAfford(8)) {
          option.options.forEach((m, i) => out.push({label: `milestone ${titleText(m.title)}`, response: wrap(index, {type: 'or', index: i, response: {type: 'option'}})}));
        } else if (option instanceof SelectSpace && title.includes('plants into greenery')) {
          out.push({label: 'plants', response: wrap(index, this.respond(option))});
        } else if (title === 'Convert 8 heat into temperature' && option.eligibleForDefault !== false) {
          out.push({label: 'heat', response: wrap(index, {type: 'option'})});
        } else if (title.startsWith('Fund an award') && option instanceof OrOptions) {
          option.options.forEach((a, i) => out.push({label: `award ${titleText(a.title)}`, response: wrap(index, {type: 'or', index: i, response: {type: 'option'}})}));
        } else if (option instanceof SelectCard && option.config.selectBlueCardAction === true) {
          for (const card of option.cards) {
            out.push({label: `action ${card.name}`, response: wrap(index, {type: 'card', cards: [card.name]})});
          }
        } else if (option instanceof SelectProjectCardToPlay) {
          const ranked = option.cards
            .map((card) => ({card, score: this.cardScore(card)}))
            .sort((a, b) => b.score - a.score);
          let taken = 0;
          for (const {card} of ranked) {
            const payment = this.cardPayment(card);
            if (payment !== undefined && taken < maxCards) {
              out.push({label: `play ${card.name}`, response: wrap(index, {type: 'projectCard', card: card.name, payment})});
              taken++;
            }
          }
        } else if (option instanceof SelectStandardProjectToPlay) {
          option.cards.forEach((card: IStandardProjectCard, i: number) => {
            if (option.enabled?.[i] === false || this.standardProjectValue(card.name) <= 0) {
              return;
            }
            const canPayWith = card.canPayWith(this.player);
            const payment = this.buildPayment(card.getAdjustedCost(this.player), {steel: canPayWith.steel, titanium: canPayWith.titanium});
            if (payment !== undefined) {
              out.push({label: `sp ${card.name}`, response: wrap(index, {type: 'projectCard', card: card.name, payment})});
            }
          });
        } else if (title === 'Pass for this generation' || title === 'End Turn') {
          out.push({label: title, response: wrap(index, {type: 'option'})});
        }
      } catch {
        this.stats.fallbacks++;
      }
    });
    return out;
  }

  private respondPlayCard(input: SelectProjectCardToPlay): InputResponse | undefined {
    return this.bestCardToPlay(input)?.response;
  }

  private bestCardToPlay(input: SelectProjectCardToPlay): {response: InputResponse, score: number} | undefined {
    const candidates = input.cards
      .map((card) => ({card, score: this.cardScore(card)}))
      // Late in the game, don't sink money into cards that return nothing in time.
      .filter((e) => e.score > (this.generationsLeft() <= 1 ? 0 : this.strategy.playThreshold))
      .sort((a, b) => b.score - a.score);
    for (const {card, score} of candidates) {
      const payment = this.cardPayment(card);
      if (payment !== undefined) {
        return {response: {type: 'projectCard', card: card.name, payment}, score};
      }
    }
    return undefined;
  }

  /** Estimated value in M€ of a standard project, before paying for it. */
  public standardProjectValue(name: CardName): number {
    const game = this.game;
    const gensLeft = this.generationsLeft();
    const payouts = Math.max(0, gensLeft - 1);
    switch (name) {
    case CardName.GREENERY_STANDARD_PROJECT:
      return this.vpValue(gensLeft) + 1 + this.milestoneBonus('Gardener') +
        (game.getOxygenLevel() < MAX_OXYGEN_LEVEL ? this.trValue(gensLeft) : 0);
    case CardName.AQUIFER_STANDARD_PROJECT:
      return game.board.getOceanSpaces().length < MAX_OCEAN_TILES ? this.trValue(gensLeft) + 2 : 0;
    case CardName.ASTEROID_STANDARD_PROJECT:
      return game.getTemperature() < MAX_TEMPERATURE ? this.trValue(gensLeft) : 0;
    case CardName.CITY_STANDARD_PROJECT:
      return this.strategy.cityValue + Math.min(gensLeft, 6) + payouts + this.milestoneBonus('Mayor');
    case CardName.POWER_PLANT_STANDARD_PROJECT:
      return PRODUCTION_VALUE.energy * payouts * this.strategy.productionWeight;
    default:
      return 0;
    }
  }

  private bestStandardProject(input: SelectStandardProjectToPlay): {response: InputResponse, score: number} | undefined {
    const gensLeft = this.generationsLeft();
    // Keep a reserve for buying cards unless the game is nearly over.
    const reserve = gensLeft > 3 ? this.strategy.standardProjectReserve : gensLeft > 1 ? 5 : 0;
    let best: {response: InputResponse, score: number} | undefined;
    input.cards.forEach((card: IStandardProjectCard, idx: number) => {
      if (input.enabled?.[idx] === false) {
        return;
      }
      const cost = card.getAdjustedCost(this.player);
      // Left-over M€ is worth nothing to us at the end, so spend it on anything that scores.
      const score = this.standardProjectValue(card.name) - (this.isLastGeneration() ? 0 : cost);
      if (score <= this.strategy.standardProjectThreshold || (best !== undefined && score <= best.score) ||
        this.standardProjectValue(card.name) <= 0) {
        return;
      }
      if (this.player.spendableMegacredits() - cost < reserve) {
        return;
      }
      const canPayWith = card.canPayWith(this.player);
      const payment = this.buildPayment(cost, {steel: canPayWith.steel, titanium: canPayWith.titanium});
      if (payment !== undefined) {
        best = {response: {type: 'projectCard', card: card.name, payment}, score};
      }
    });
    return best;
  }

  private chooseAward(menu: OrOptions): InputResponse | undefined {
    const idx = menu.options.findIndex((o) => titleText(o.title).startsWith('Fund an award'));
    if (idx < 0) {
      return undefined;
    }
    const marsBot = this.game.automaHooks?.marsBot;
    if (marsBot === undefined) {
      return undefined;
    }
    // Only fund when the lead looks safe and the game is past its midpoint.
    if (this.generationsLeft() > this.strategy.awardWindow) {
      return undefined;
    }
    const sub = menu.options[idx] as OrOptions;
    const unfunded = this.game.awards.filter((a) => !this.game.hasBeenFunded(a));
    let bestIdx = -1;
    let bestMargin = 2;
    unfunded.forEach((award: IAward, i: number) => {
      const margin = award.getScore(this.player) - marsBot.turnResolver.getMarsBotAwardValue(award);
      if (margin > bestMargin) {
        bestMargin = margin;
        bestIdx = i;
      }
    });
    if (bestIdx < 0 || bestIdx >= sub.options.length) {
      return undefined;
    }
    return {type: 'or', index: idx, response: {type: 'or', index: bestIdx, response: {type: 'option'}}};
  }

  public get opponent(): IPlayer | undefined {
    return this.marsBot;
  }
}
