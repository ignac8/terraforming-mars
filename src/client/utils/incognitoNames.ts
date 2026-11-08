import {PLAYER_COLOR_LABELS} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {ViewModel} from '@/common/models/PlayerModel';
import {translateText} from '@/client/directives/i18n';

const FAKE_NAMES: ReadonlySet<string> = new Set(Object.values(PLAYER_COLOR_LABELS));

/**
 * Translates the fake opponent names of an incognito game into the language of the viewer.
 *
 * Until the game ends, the server names each opponent after a color, in English. Returns a translated copy, or
 * `model` itself when the game is not incognito or is over, when every name is real.
 */
export function translateFakeNames<T extends ViewModel>(model: T): T {
  if (!model.game.gameOptions.incognito || model.game.phase === Phase.END) {
    return model;
  }
  return walk(model, model.thisPlayer?.name) as T;
}

// The viewer's own name is real, and may be a color label.
function walk(value: unknown, ownName: string | undefined): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, ownName));
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  // A player model has a `color`, and a card model does not.
  const isPlayer = 'color' in value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    const holdsPlayerName = key === 'playerName' || (key === 'name' && isPlayer);
    out[key] = holdsPlayerName && typeof v === 'string' && FAKE_NAMES.has(v) && v !== ownName ? translateText(v) : walk(v, ownName);
  }
  return out;
}
