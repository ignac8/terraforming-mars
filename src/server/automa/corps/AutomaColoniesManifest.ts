import {IMarsBotCorp} from '../MarsBotCorpTypes';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {AutomaManifest} from './AutomaManifest';
import {whiteTrackCubes} from './BaseGameCorps';

// ==== COLONIES (C30-C33) ====

// C30 Aridor
const ARIDOR: IMarsBotCorp = {
  name: CardName.ARIDOR,
  description: 'Draft: least-advanced track tag. Setup: place 1 colony. White and black cubes across multiple tracks; each cube advances event track.',
  tags: [],
  draftPriority: {type: 'leastAdvancedTrack'},
  trackCubes: [
    {trackIndex: 0, position: 3, cubeType: 'white'},
    {trackIndex: 1, position: 3, cubeType: 'white'},
    {trackIndex: 3, position: 3, cubeType: 'white'},
    {trackIndex: 4, position: 3, cubeType: 'white'},
    {trackIndex: 4, position: 6, cubeType: 'white'},
    {trackIndex: 5, position: 3, cubeType: 'black'},
    {trackIndex: 5, position: 6, cubeType: 'black'},
    {trackIndex: 6, position: 3, cubeType: 'black'},
    {trackIndex: 6, position: 6, cubeType: 'black'},
  ],
  setup(bot) {
    // C-30: Place 1 colony using random selection (C-15b method)
    const placed = bot.maybePlaceRandomColony();
    if (placed) {
      bot.game.log('MarsBot (Aridor): placed 1 colony (C-30)');
    } else {
      bot.game.log('MarsBot (Aridor): no eligible colony tile for setup (C-30)');
    }
  },
  effect: {
    onTrackCubeTrigger(bot, _trackIndex, _position, _cubeType) {
      bot.advanceTrack(2); // Event track = index 2
      bot.game.log('MarsBot (Aridor): cube reached — advance event track');
    },
  },
};

// C31 Arclight
const ARCLIGHT: IMarsBotCorp = {
  name: CardName.ARKLIGHT,
  description: 'Tag: Animal. Draft: Animal > Plant. White cubes on plant track. Plant or Animal cards earn 2 MC.',
  tags: [Tag.ANIMAL],
  draftPriority: {type: 'tags', tags: [Tag.ANIMAL, Tag.PLANT]},
  trackCubes: whiteTrackCubes(6),
  effect: {
    onProjectCardResolved(bot, card) {
      if (card.tags.some((t) => t === Tag.PLANT || t === Tag.ANIMAL)) {
        bot.gainMc(2);
        bot.game.log('MarsBot (Arclight): Plant/Animal card, +2 M€');
      }
    },
  },
};

// C32 Polyphemos
const POLYPHEMOS: IMarsBotCorp = {
  name: CardName.POLYPHEMOS,
  description: 'Tags: 3 Space, 3 Event. Setup: +25 MC. Each generation: discard the card with fewest tags from the action deck.',
  tags: [Tag.SPACE, Tag.SPACE, Tag.SPACE, Tag.EVENT, Tag.EVENT, Tag.EVENT],
  setup(bot) {
    bot.gainMc(25);
    bot.game.log('MarsBot (Polyphemos): +25 M€');
  },
  beforeActionPhase(bot) {
    bot.discardCardWithFewestTags();
  },
};

// C33 Poseidon
const POSEIDON: IMarsBotCorp = {
  name: CardName.POSEIDON,
  description: 'Setup: place 1 colony. Colony placement advances least-advanced track.',
  tags: [],
  setup(bot) {
    // C-33: Place 1 colony using random selection (C-15b method)
    const placed = bot.maybePlaceRandomColony();
    if (placed) {
      bot.game.log('MarsBot (Poseidon): placed 1 colony (C-33)');
    } else {
      bot.game.log('MarsBot (Poseidon): no eligible colony tile for setup (C-33)');
    }
  },
  // C-33: each colony placement advances the least-advanced track
  effect: {
    onColonyPlaced(bot) {
      bot.advanceTrack(bot.tracks.getLeastAdvancedTrackIndex());
      bot.game.log('MarsBot (Poseidon): colony placed → advance least-advanced track (C-33)');
    },
  },
};

export const AUTOMA_COLONIES_MANIFEST: AutomaManifest = {
  corps: {
    [CardName.ARIDOR]: ARIDOR,
    [CardName.ARKLIGHT]: ARCLIGHT,
    [CardName.POLYPHEMOS]: POLYPHEMOS,
    [CardName.POSEIDON]: POSEIDON,
  },
};
