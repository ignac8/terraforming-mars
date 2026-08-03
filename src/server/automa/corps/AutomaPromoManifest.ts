import {IMarsBotCorp} from '../MarsBotCorpTypes';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {AutomaManifest} from './AutomaManifest';

// ==== PROMO (C21-C24) ====

// C21 Pharmacy Union
const PHARMACY_UNION: IMarsBotCorp = {
  name: CardName.PHARMACY_UNION,
  description: 'Tag: Science. Draft: Science. Setup: remove Meteor Shower. Science cards give +1 TR. When human plays a Microbe card, lose 4 MC.',
  tags: [Tag.SCIENCE],
  draftPriority: {type: 'tags', tags: [Tag.SCIENCE]},
  setup(bot) {
    bot.removeBonusCard(BonusCardId.B01_METEOR_SHOWER);
    bot.game.log('MarsBot (Pharmacy Union): Meteor Shower removed, science card added to bonus deck');
  },
  effect: {
    onProjectCardResolved(bot, card) {
      if (card.tags.includes(Tag.SCIENCE)) {
        bot.raiseTR(1);
        bot.game.log('MarsBot (Pharmacy Union): science card, TR +1');
      }
    },
    onHumanCardPlayed(bot, card) {
      if (card.tags.includes(Tag.MICROBE)) {
        bot.megacredits = Math.max(0, bot.megacredits - 4);
        bot.game.log('MarsBot (Pharmacy Union): human played microbe, -4 M€');
      }
    },
  },
};

// C22 Philares
const PHILARES: IMarsBotCorp = {
  name: CardName.PHILARES,
  description: 'Setup: place greenery, +1 science resource, add Build Build Build to bonus deck. Spend 4 science resources to advance most-advanced track.',
  tags: [],
  setup(bot) {
    bot.placeGreenery();
    bot.setCorpState('scienceResources', 1);
    // B07 Local Neural Instance resolved and removed during setup
    // B27 Build Build Build added to bonus deck
    bot.addBonusCardToBonusDeck(BonusCardId.B27_BUILD_BUILD_BUILD);
    bot.game.log('MarsBot (Philares): placed greenery, +1 science resource, B07 resolved, B27 added');
  },
  effect: {
    // When adjacent to player tile: +1 science. Spend 4 -> advance most advanced non-maxed track.
    onProjectCardResolved(bot, _card) {
      // Simplified: accumulate science resources
      const science = bot.getCorpState('scienceResources');
      if (science >= 4) {
        bot.setCorpState('scienceResources', science - 4);
        const trackIdx = bot.tracks.getMostAdvancedTrackIndex();
        bot.advanceTrack(trackIdx);
        bot.game.log('MarsBot (Philares): spent 4 science, advance most-advanced track');
      }
    },
  },
};

// C23 Recyclone
const RECYCLONE: IMarsBotCorp = {
  name: CardName.RECYCLON,
  description: 'Tag: Microbe. Draft: Building. White cubes on building track. Each white cube advances the plant track.',
  tags: [Tag.MICROBE],
  draftPriority: {type: 'tags', tags: [Tag.BUILDING]},
  trackCubes: [
    {trackIndex: 0, position: 3, cubeType: 'white'},
    {trackIndex: 0, position: 6, cubeType: 'white'},
    {trackIndex: 0, position: 9, cubeType: 'white'},
    {trackIndex: 0, position: 12, cubeType: 'white'},
    {trackIndex: 0, position: 15, cubeType: 'white'},
    {trackIndex: 0, position: 18, cubeType: 'white'},
  ],
  effect: {
    onTrackCubeTrigger(bot, trackIndex, _position, cubeType) {
      if (cubeType === 'white' && trackIndex === 0) {
        bot.advanceTrack(6); // Plant track = index 6
        bot.game.log('MarsBot (Recyclone): white cube on building track — advance plant track');
      }
    },
  },
};

// C24 Splice
const SPLICE: IMarsBotCorp = {
  name: CardName.SPLICE,
  description: 'Tag: Plant. Draft: Microbe. Setup: +8 MC, remove R&D. Microbe cards earn 4 MC. When human plays a Microbe card, earn 2 MC.',
  tags: [Tag.PLANT],
  draftPriority: {type: 'tags', tags: [Tag.MICROBE]},
  setup(bot) {
    bot.gainMc(8);
    bot.removeBonusCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT);
    bot.game.log('MarsBot (Splice): +8 M€, R&D removed, microbe card added to bonus deck');
  },
  effect: {
    onProjectCardResolved(bot, card) {
      if (card.tags.includes(Tag.MICROBE)) {
        bot.gainMc(4);
        bot.game.log('MarsBot (Splice): microbe card, +4 M€');
      }
    },
    onHumanCardPlayed(bot, card) {
      if (card.tags.includes(Tag.MICROBE)) {
        bot.gainMc(2);
        bot.game.log('MarsBot (Splice): human played microbe, +2 M€');
      }
    },
  },
};

export const AUTOMA_PROMO_MANIFEST: AutomaManifest = {
  corps: {
    [CardName.PHARMACY_UNION]: PHARMACY_UNION,
    [CardName.PHILARES]: PHILARES,
    [CardName.RECYCLON]: RECYCLONE,
    [CardName.SPLICE]: SPLICE,
  },
};
