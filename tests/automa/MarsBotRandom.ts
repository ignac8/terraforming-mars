import {MarsBot} from '@/server/automa/MarsBot';
import {Random} from '@/common/utils/Random';

/** Replaces the random source that `marsBot` shuffles and inserts cards with. */
export function setMarsBotRandom(marsBot: MarsBot, random: Random): void {
  Reflect.set(marsBot, 'random', random);
  Reflect.set(marsBot.actionDeck, 'random', random);
}
