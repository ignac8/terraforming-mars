// Remembers how someone watches a replay, so a reload keeps it: whether autoplay waits as long as the players took,
// and whether the log shows beside the board.
import {LocalStorageStore} from '@/client/utils/LocalStorageStore';

const store = new LocalStorageStore<boolean>({prefix: 'replay:'});

export function isRealTime(): boolean {
  return store.get('realTime') === true;
}

export function setRealTime(realTime: boolean): void {
  store.set('realTime', realTime);
}

export function isLogShown(): boolean {
  return store.get('log') === true;
}

export function setLogShown(shown: boolean): void {
  store.set('log', shown);
}
