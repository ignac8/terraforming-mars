// Remembers which players someone has hidden in the replay hands, per participant link,
// so a reload keeps them hidden. Entries expire (and are swept) so flags from finished
// games don't accumulate.
import {Color} from '@/common/Color';
import {ParticipantId} from '@/common/Types';
import {LocalStorageStore} from '@/client/utils/LocalStorageStore';

const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const store = new LocalStorageStore<true>({prefix: 'replayPanelHidden:', ttlMs: TTL_MS});

function key(id: ParticipantId, color: Color): string {
  return id + ':' + color;
}

export function isPanelHidden(id: ParticipantId, color: Color): boolean {
  return store.get(key(id, color)) !== undefined;
}

export function setPanelHidden(id: ParticipantId, color: Color, hidden: boolean): void {
  if (hidden) {
    store.set(key(id, color), true);
  } else {
    store.remove(key(id, color));
  }
}
