/**
 * An opponent that does nothing: it keeps no project cards, passes every generation and skips
 * every optional choice. Used to measure how far MarsBot gets on its own.
 *
 * The rules still make it keep 2 preludes and pick 1 card per draft round. It keeps the preludes
 * least likely to touch the shared board or global parameters, and takes the first card of each
 * draft pile (piles come off a shuffled deck, so that is a random pick).
 */
import {IPlayer} from '../../src/server/IPlayer';
import {PlayerInput} from '../../src/server/PlayerInput';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {ICard} from '../../src/server/cards/ICard';
import {IPreludeCard} from '../../src/server/cards/prelude/IPreludeCard';
import {CardName} from '../../src/common/cards/CardName';
import {Message} from '../../src/common/logs/Message';
import {ScriptedPlayer} from './ScriptedPlayer';

function titleText(title: string | Message): string {
  return typeof title === 'string' ? title : title.message;
}

/** Behavior keys that reach the board, the global parameters or MarsBot. */
const SHARED_EFFECTS = ['global', 'city', 'greenery', 'ocean', 'tile', 'colonies', 'turmoil',
  'decreaseAnyProduction', 'removeAnyPlants', 'removeResourcesFromAnyCard', 'or'] as const;

/** Higher means the prelude is more likely to change the game MarsBot plays in. */
export function preludeImpact(card: ICard): number {
  let impact = 0;
  const behavior = card.behavior as Record<string, unknown> | undefined;
  for (const key of SHARED_EFFECTS) {
    if (behavior?.[key] !== undefined) {
      impact += 10;
    }
  }
  // Cards with their own play code can do anything.
  const proto = Object.getPrototypeOf(card);
  if (Object.prototype.hasOwnProperty.call(proto, 'bespokePlay') || Object.prototype.hasOwnProperty.call(proto, 'play')) {
    impact += 5;
  }
  return impact;
}

export class PassingPlayer {
  private readonly fallback: ScriptedPlayer;
  public readonly stats: ScriptedPlayer['stats'];

  constructor(public readonly player: IPlayer, private readonly corporation: CardName) {
    this.fallback = new ScriptedPlayer(player, corporation);
    this.stats = this.fallback.stats;
  }

  public respond(input: PlayerInput): InputResponse {
    if (input instanceof SelectInitialCards) {
      this.stats.inputs++;
      return this.respondInitialCards(input);
    }
    if (input instanceof OrOptions) {
      this.stats.inputs++;
      const titles = input.options.map((o) => titleText(o.title));
      const pass = titles.findIndex((t) => t === 'Pass for this generation' || t === 'End Turn');
      if (pass >= 0) {
        return {type: 'or', index: pass, response: {type: 'option'}};
      }
      const noop = titles.findIndex((t) => /^(don't|do not|skip|pass|none)/i.test(t.trim()));
      if (noop >= 0 && this.canAnswer(input.options[noop])) {
        return {type: 'or', index: noop, response: {type: 'option'}};
      }
      return this.fallback.respond(input);
    }
    if (input instanceof SelectCard) {
      const {min} = input.config;
      if (titleText(input.title).startsWith('Draft round')) {
        this.stats.inputs++;
        return {type: 'card', cards: [input.cards[0].name]};
      }
      if (min === 0) {
        this.stats.inputs++;
        return {type: 'card', cards: []};
      }
    }
    return this.fallback.respond(input);
  }

  private canAnswer(option: PlayerInput): boolean {
    return option.constructor.name === 'SelectOption';
  }

  private respondInitialCards(input: SelectInitialCards): InputResponse {
    const responses: Array<InputResponse> = [];
    for (const option of input.options) {
      if (option === input.inputs.corp) {
        const corp = (option as SelectCard<ICard>).cards.find((c) => c.name === this.corporation);
        if (corp === undefined) {
          throw new Error(`PassingPlayer: corporation ${this.corporation} not dealt`);
        }
        responses.push({type: 'card', cards: [corp.name]});
      } else if (option === input.inputs.prelude) {
        const preludes = [...(option as SelectCard<IPreludeCard>).cards]
          .map((card, i) => ({card, impact: preludeImpact(card), i}))
          .sort((a, b) => a.impact - b.impact || a.i - b.i);
        responses.push({type: 'card', cards: preludes.slice(0, 2).map((p) => p.card.name)});
      } else if (option === input.inputs.project) {
        responses.push({type: 'card', cards: []});
      } else {
        responses.push(this.fallback.respond(option));
      }
    }
    return {type: 'initialCards', responses};
  }
}
