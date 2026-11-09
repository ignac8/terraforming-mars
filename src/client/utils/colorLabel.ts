import {PLAYER_COLOR_LABELS, PlayerColor} from '@/common/Color';
import {translateText} from '@/client/directives/i18n';

// "Clear" is also the label of a button that clears a selection, so the clear color is translated from
// "Transparent", which keeps the two translations apart.
const TRANSLATED_FROM: Partial<Record<PlayerColor, string>> = {clear: 'Transparent'};

/** Returns the name of a player color in the viewer's language, or its English label when the language has none. */
export function translateColorLabel(color: PlayerColor): string {
  const key = TRANSLATED_FROM[color] ?? PLAYER_COLOR_LABELS[color];
  const translated = translateText(key);
  return translated === key ? PLAYER_COLOR_LABELS[color] : translated;
}
