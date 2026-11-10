import {CardName} from '@/common/cards/CardName';
import {IMarsBotCorp} from '@/server/automa/IMarsBotCorp';

// C33 Poseidon
export const POSEIDON_MARSBOT_CORP: IMarsBotCorp = {
  name: CardName.POSEIDON,
  description: 'Setup: place 1 colony. Each colony you or MarsBot build (setup included) advances MarsBot\'s least-advanced track.',
  tags: [],
  requiredExpansions: ['colonies'],
  setup(marsBot) {
    // C-33: Place 1 colony using random selection (C-15b method)
    const placed = marsBot.maybePlaceRandomColony();
    if (placed) {
      marsBot.game.log('MarsBot (Poseidon): placed 1 colony (C-33)');
    } else {
      marsBot.game.log('MarsBot (Poseidon): no eligible colony tile for setup (C-33)');
    }
  },
  // C-33: each colony either player builds advances the least-advanced track
  effect: {
    onColonyPlaced(marsBot) {
      marsBot.advanceTrack(marsBot.marsBotBoard.getLeastAdvancedTrackIndex());
      marsBot.game.log('MarsBot (Poseidon): colony placed → advance least-advanced track (C-33)');
    },
  },
};
