import {MarsBot} from '@/server/automa/MarsBot';

/** Puts every track of MarsBot's board on its last space, so that advancing any of them fails. */
export function maxTracks(marsBot: MarsBot): void {
  for (const track of marsBot.marsBotBoard.tracks) {
    track.position = track.definition.layout.length - 1;
  }
}
