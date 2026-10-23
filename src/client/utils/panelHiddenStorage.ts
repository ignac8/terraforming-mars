// Remembers which players someone has hidden on the judge page and in the replay hands,
// per participant link, so a reload keeps them hidden. Entries expire (and are swept)
// so flags from finished games don't accumulate.
import {Color} from '@/common/Color';
import {ParticipantId} from '@/common/Types';
import {LocalStorageStore} from '@/client/utils/LocalStorageStore';

const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// The prefix predates the replay hands and stays, so panels already hidden on the judge page stay hidden.
const store = new LocalStorageStore<true>({prefix: 'judgePanelHidden:', ttlMs: TTL_MS});

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
