import {PLAYER_COLORS, PLAYER_COLOR_LABELS, PlayerColor} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {ViewModel} from '@/common/models/PlayerModel';
import {isJudgeId} from '@/common/Types';
import {translateColorLabel} from '@/client/utils/colorLabel';

const FAKE_NAMES: ReadonlyMap<string, PlayerColor> = new Map(PLAYER_COLORS.map((color) => [PLAYER_COLOR_LABELS[color], color]));

/**
 * Translates the fake opponent names of an incognito game into the language of the viewer.
 *
 * Until the game ends, the server names each opponent after a color, in English. Returns a translated copy, or
 * `model` itself when the game is not incognito or is over, when every name is real.
 *
 * A judge has no seat, so every name in what a judge sees is a fake, also that of the seat it views as.
 */
export function translateFakeNames<T extends ViewModel>(model: T): T {
  if (!model.game.gameOptions.incognito || model.game.phase === Phase.END) {
    return model;
  }
  return walk(model, isJudgeId(model.id) ? undefined : model.thisPlayer?.name) as T;
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
    const color = holdsPlayerName && typeof v === 'string' && v !== ownName ? FAKE_NAMES.get(v) : undefined;
    out[key] = color !== undefined ? translateColorLabel(color) : walk(v, ownName);
  }
  return out;
}
