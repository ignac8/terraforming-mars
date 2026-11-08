import {createHash} from 'crypto';
import {Color, PLAYER_COLORS, PLAYER_COLOR_LABELS, PlayerColor} from '@/common/Color';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {COLOR_KEYS} from '@/common/models/colorKeys';
import {Phase} from '@/common/Phase';
import {ParticipantId} from '@/common/Types';
import {SeededRandom} from '@/common/utils/Random';
import {IGame} from '@/server/IGame';
import {InputError} from '@/server/inputs/InputError';
import {shuffleSeats} from '@/server/incognito/shuffleSeats';

/**
 * What one viewer sees in place of the other seats of an incognito game: each opponent's color and name
 * replaced by a fake color and that color's label.
 *
 * It is the same for a viewer on every call, and different between viewers.
 */
export type IncognitoMask = {
  /** Real color to fake color. Opponents only, or every seat for a spectator. */
  readonly colors: ReadonlyMap<Color, Color>;
  /** Fake color to real color. */
  readonly reverse: ReadonlyMap<Color, Color>;
  /** Real name to fake name, the label of the fake color. */
  readonly names: ReadonlyMap<string, string>;
};

// Keeps a name from matching inside a longer word, so that "Al" does not rewrite "Almost".
const BEFORE_NAME = '(?<![\\p{L}\\p{N}_])';
const AFTER_NAME = '(?![\\p{L}\\p{N}_])';
// A name followed by this is a "name: score" run in a message string.
const BEFORE_SCORE = '(?=: )';

const regexes = new WeakMap<IncognitoMask, Map<string, RegExp>>();

function seededRandom(game: IGame, viewerId: ParticipantId): SeededRandom {
  const digest = createHash('sha256').update(`${game.id}:${viewerId}`).digest();
  return new SeededRandom(digest.readUInt32BE(0) / 4294967296);
}

/**
 * Builds the mask for a viewer of a live incognito game.
 *
 * Returns `undefined` when nothing is hidden from the viewer: the option is off, the game is over, or the
 * viewer is a judge or unknown. A player's own seat is not masked, and a spectator's mask covers every seat.
 */
export function incognitoMask(game: IGame, viewerId: ParticipantId): IncognitoMask | undefined {
  if (!game.gameOptions.incognito || game.phase === Phase.END) {
    return undefined;
  }
  let seats = game.players;
  let fakes: ReadonlyArray<PlayerColor> = PLAYER_COLORS;
  if (viewerId !== game.spectatorId) {
    const viewer = game.players.find((player) => player.id === viewerId);
    if (viewer === undefined) {
      return undefined;
    }
    seats = game.players.filter((player) => player !== viewer);
    fakes = PLAYER_COLORS.filter((color) => color !== viewer.color);
  }
  fakes = shuffleSeats(fakes, seededRandom(game, viewerId));

  const colors = new Map<Color, Color>();
  const reverse = new Map<Color, Color>();
  const names = new Map<string, string>();
  seats.forEach((seat, i) => {
    colors.set(seat.color, fakes[i]);
    reverse.set(fakes[i], seat.color);
    // An empty name would match everywhere.
    if (seat.name !== '') {
      names.set(seat.name, PLAYER_COLOR_LABELS[fakes[i]]);
    }
  });
  return {colors, reverse, names};
}

/**
 * Returns a copy of `value` in which every opponent's color and name is replaced by its fake.
 *
 * Colors are rewritten under the keys in `COLOR_KEYS` and in the value of a PLAYER log datum. Names are
 * rewritten in `name` next to a player's color, in `playerName`, in `messageArgs`, and in "name: " runs
 * of a STRING or RAW_STRING log datum. Each original value is replaced once, so a fake is never rewritten.
 */
export function maskModel<T>(value: T, mask: IncognitoMask | undefined): T {
  return mask === undefined ? value : walk(value, mask, undefined) as T;
}

/** Replaces each opponent's name in free text with its fake. */
export function maskText(text: string, mask: IncognitoMask | undefined): string {
  return mask === undefined ? text : replaceNames(text, mask, AFTER_NAME);
}

/**
 * Returns the real color of a fake color in a viewer's request.
 *
 * Throws an `InputError` for the real color of an opponent, unless it is also another opponent's fake:
 * answering it would tell the viewer which seat it is. Any other color is returned as it is.
 */
export function unmaskColor<T extends string>(color: T, mask: IncognitoMask | undefined): T {
  if (mask === undefined) {
    return color;
  }
  const real = mask.reverse.get(color as Color);
  if (real !== undefined) {
    return real as T;
  }
  if (mask.colors.has(color as Color)) {
    throw new InputError('Unknown player');
  }
  return color;
}

function maskColor(color: string, mask: IncognitoMask): string {
  return mask.colors.get(color as Color) ?? color;
}

function walk(value: unknown, mask: IncognitoMask, key: string | undefined): unknown {
  if (typeof value === 'string') {
    if (key === undefined) {
      return value;
    }
    if (COLOR_KEYS.has(key)) {
      return maskColor(value, mask);
    }
    if (key === 'playerName' || key === 'messageArgs') {
      return mask.names.get(value) ?? value;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, mask, key));
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  const hasColor = typeof record.color === 'string';
  const fakeColor = hasColor ? mask.colors.get(record.color as Color) : undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (k === 'name' && fakeColor !== undefined && !('playerName' in record) && typeof v === 'string' && mask.names.has(v)) {
      // A milestone or award has a `name` and a `color` too, and tells itself apart by its `playerName`.
      out[k] = PLAYER_COLOR_LABELS[fakeColor as PlayerColor];
    } else if (k === 'milestoneResults' && key === 'aresData') {
      // It lists the seats by player id, in seat order, and the client does not read it.
      out[k] = [];
    } else if (k === 'playerName' && hasColor && typeof v === 'string') {
      // The color says whose name it is, which two players with the same name could not.
      out[k] = fakeColor === undefined ? v : PLAYER_COLOR_LABELS[fakeColor as PlayerColor];
    } else {
      out[k] = walk(v, mask, k);
    }
  }
  // In log data, `value` is a color only for a PLAYER datum, and a string with names only for a STRING one.
  if (typeof record.value === 'string') {
    if (record.type === LogMessageDataType.PLAYER) {
      out.value = maskColor(record.value, mask);
    } else if (record.type === LogMessageDataType.STRING || record.type === LogMessageDataType.RAW_STRING) {
      out.value = replaceNames(record.value, mask, BEFORE_SCORE);
    }
  }
  return out;
}

// Replaces the names that `after` follows in one pass over `text`, so a fake that equals a real name stays.
function replaceNames(text: string, mask: IncognitoMask, after: string): string {
  const regex = namesRegex(mask, after);
  return regex === undefined ? text : text.replace(regex, (name) => mask.names.get(name) ?? name);
}

function namesRegex(mask: IncognitoMask, after: string): RegExp | undefined {
  if (mask.names.size === 0) {
    return undefined;
  }
  let cached = regexes.get(mask);
  if (cached === undefined) {
    cached = new Map();
    regexes.set(mask, cached);
  }
  let regex = cached.get(after);
  if (regex === undefined) {
    // Longest first, so that a name that starts another one is not cut short.
    const alternatives = [...mask.names.keys()]
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    regex = new RegExp(`${BEFORE_NAME}(?:${alternatives.join('|')})${after}`, 'gu');
    cached.set(after, regex);
  }
  return regex;
}
