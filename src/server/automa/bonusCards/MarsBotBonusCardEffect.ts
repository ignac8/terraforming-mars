import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';
import type {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';

/** What a bonus card does when MarsBot resolves it. */
export type MarsBotBonusCardEffect = {
  readonly id: BonusCardId;
  /**
   * Resolves `card` with the tools of `resolver`.
   *
   * Returns true when the card must not be discarded: it was destroyed, or it went back into the bonus deck.
   */
  resolve(resolver: MarsBotBonusResolver, card: MarsBotBonusCard): boolean;
};
