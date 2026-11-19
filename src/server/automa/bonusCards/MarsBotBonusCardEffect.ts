import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

export type MarsBotBonusCardEffectProperties = Pick<MarsBotBonusCardEffect, 'id'>;

/**
 * A bonus card MarsBot resolves.
 *
 * It keeps no state of its own: one instance serves every game.
 */
export abstract class MarsBotBonusCardEffect {
  public readonly id: BonusCardId;

  constructor(properties: MarsBotBonusCardEffectProperties) {
    this.id = properties.id;
  }

  /**
   * Resolves `card` with the tools of `resolver`.
   *
   * Returns true when the card must not be discarded: it was destroyed, or it went back into the bonus deck.
   */
  public abstract resolve(resolver: MarsBotBonusResolver, card: MarsBotBonusCard): boolean;
}
