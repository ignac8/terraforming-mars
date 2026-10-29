import {createHash} from 'crypto';
import {SerializedAutomaState, SerializedGame} from '../SerializedGame';
import {GameOptions} from '../game/GameOptions';
import {CardName} from '../../common/cards/CardName';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {createCorpBonusCard} from '../automa/MarsBotBonusCard';

type Json = string | number | boolean | null | undefined | ReadonlyArray<Json> | {readonly [key: string]: Json};

// JSON with sorted keys and without undefined values. A live object and a loaded one can hold
// the same data with keys inserted in a different order.
function canonical(value: Json): string {
  if (value === undefined || value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonical).join(',') + ']';
  }
  if (typeof value === 'object') {
    const object = value as {readonly [key: string]: Json};
    const members: Array<string> = [];
    for (const key of Object.keys(object).sort()) {
      if (object[key] !== undefined) {
        members.push(JSON.stringify(key) + ':' + canonical(object[key]));
      }
    }
    return '{' + members.join(',') + '}';
  }
  return JSON.stringify(value);
}

// Leaves out what legitimately differs between a live game and a replay of it. The log is
// replaced by its length: timestamps differ in a replay, but a missing or extra line still shows.
// The table state (a freeze, a vote, the request bar) is patched into saves without an input.
function comparable(d: SerializedGame): string {
  const {
    gameLog, lastSaveId: _lastSaveId, undoCount: _undoCount, gameAge: _gameAge, inputs: _inputs,
    frozen: _frozen, rewindVote: _rewindVote, rewindRequestLimits: _rewindRequestLimits,
    ...rest
  } = d;
  const players = d.players.map(({timer: _timer, ...player}) => player);
  // Hashes recorded before automaOption was renamed to automa hold the old name, so the comparison keeps it.
  const {automa, ...options} = d.gameOptions as Partial<GameOptions> & {automaOption?: boolean};
  const gameOptions = {...options, automaOption: automa ?? options.automaOption};
  const automaState = d.automaState === undefined ? undefined : withOldBonusDeckPiles(d.automaState);
  return canonical({...rest, gameOptions, automaState, players, gameLog: gameLog.length} as unknown as Json);
}

// Hashes recorded before MarsBot's bonus deck was saved like the other decks hold its piles under their
// own keys, with bonus cards by id, so the comparison keeps that form.
function withOldBonusDeckPiles(state: SerializedAutomaState): Omit<SerializedAutomaState, 'bonusDeck'> {
  if (state.bonusDeck === undefined) {
    return state;
  }
  const ids = new Map(Object.values(BonusCardId).map((id) => [createCorpBonusCard(id).name, id]));
  const toOldForm = (name: CardName) => ids.get(name) ?? name;
  const {bonusDeck, ...rest} = state;
  return {...rest, bonusDeckDrawPile: bonusDeck.drawPile.map(toOldForm), bonusDeckDiscardPile: bonusDeck.discardPile.map(toOldForm)};
}

/** sha256 (hex) of the game's state, leaving out what legitimately differs between a live game and a replay of it. */
export function stateHash(d: SerializedGame): string {
  return createHash('sha256').update(comparable(d)).digest('hex');
}

/** The same comparison as stateHash, without hashing: true when the two states match. */
export function sameState(a: SerializedGame, b: SerializedGame): boolean {
  return comparable(a) === comparable(b);
}
