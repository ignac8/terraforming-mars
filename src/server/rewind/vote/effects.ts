import {GameLoader} from '../../database/GameLoader';
import {rewindTable} from '../RewindService';
import {VoteEffects, VoteService} from './VoteService';
import {Clock} from '../../../common/Timer';

/** The vote service's clock. Specs point `source` at a fake clock. */
class VoteClock extends Clock {
  public source = new Clock();

  public override now(): number {
    return this.source.now();
  }
}

export const voteClock = new VoteClock();

export const voteEffects: VoteEffects = {
  // A vote rewind never touches the clocks.
  rewind: (game, saveId, cards, requester) => rewindTable(game, saveId, {cards, clocks: 'keep'}, {kind: 'vote', requester}),
  persist: async (game) => {
    // Whether the patch landed is not needed: the vote service acts the same either way (see VoteService.write).
    await game.persistTableState();
  },
  isLive: async (game) => (await GameLoader.getInstance().getGame(game.id)) === game,
};

export const voteService = new VoteService(voteEffects, voteClock);
