// Remembers which players a judge has hidden on the judge page, per judge link,
// so a reload keeps them hidden. Entries expire (and are swept) so flags from
// finished games don't accumulate.
import {Color} from '@/common/Color';
import {JudgeId} from '@/common/Types';
import {LocalStorageStore} from '@/client/utils/LocalStorageStore';

const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const store = new LocalStorageStore<true>({prefix: 'judgePanelHidden:', ttlMs: TTL_MS});

function key(judgeId: JudgeId, color: Color): string {
  return judgeId + ':' + color;
}

export function isPanelHidden(judgeId: JudgeId, color: Color): boolean {
  return store.get(key(judgeId, color)) !== undefined;
}

export function setPanelHidden(judgeId: JudgeId, color: Color, hidden: boolean): void {
  if (hidden) {
    store.set(key(judgeId, color), true);
  } else {
    store.remove(key(judgeId, color));
  }
}
