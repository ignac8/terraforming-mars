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
  startingTags: [Tag.SCIENCE],
  draftPriority: {type: 'tags', tags: [Tag.SCIENCE]},
  setup: {
    resolve(ctx) {
      ctx.removeBonusCardFromDeck(BonusCardId.B01_METEOR_SHOWER);
      ctx.gameLog('MarsBot (Pharmacy Union): Meteor Shower removed, science card added to bonus deck');
    },
  },
  effect: {
    onProjectCardResolved(ctx, card) {
      if (card.tags.includes(Tag.SCIENCE)) {
        ctx.raiseTR(1);
        ctx.gameLog('MarsBot (Pharmacy Union): science card, TR +1');
      }
    },
    onHumanCardPlayed(ctx, card) {
      if (card.tags.includes(Tag.MICROBE)) {
        ctx.setMcSupply(Math.max(0, ctx.mcSupply - 4));
        ctx.gameLog('MarsBot (Pharmacy Union): human played microbe, -4 M€');
      }
    },
  },
};

// C22 Philares
const PHILARES: IMarsBotCorp = {
  name: CardName.PHILARES,
  description: 'Setup: place greenery, +1 science resource, add Build Build Build to bonus deck. Spend 4 science resources to advance most-advanced track.',
  startingTags: [],
  setup: {
    resolve(ctx) {
      ctx.placeGreenery();
      ctx.setCorpState('scienceResources', 1);
      // B07 Local Neural Instance resolved and removed during setup
      // B27 Build Build Build added to bonus deck
      ctx.addBonusCardToBonusDeck(BonusCardId.B27_BUILD_BUILD_BUILD);
      ctx.gameLog('MarsBot (Philares): placed greenery, +1 science resource, B07 resolved, B27 added');
    },
  },
  effect: {
    // When adjacent to player tile: +1 science. Spend 4 -> advance most advanced non-maxed track.
    onProjectCardResolved(ctx, _card) {
      // Simplified: accumulate science resources
      const science = ctx.getCorpState('scienceResources');
      if (science >= 4) {
        ctx.setCorpState('scienceResources', science - 4);
        const trackIdx = ctx.mostAdvancedTrackIndex;
        ctx.advanceTrack(trackIdx);
        ctx.gameLog('MarsBot (Philares): spent 4 science, advance most-advanced track');
      }
    },
  },
  associatedBonusCards: [BonusCardId.B27_BUILD_BUILD_BUILD],
};

// C23 Recyclone
const RECYCLONE: IMarsBotCorp = {
  name: CardName.RECYCLON,
  description: 'Tag: Microbe. Draft: Building. White cubes on building track. Each white cube advances the plant track.',
  startingTags: [Tag.MICROBE],
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
    onTrackCubeTrigger(ctx, trackIndex, _position, cubeType) {
      if (cubeType === 'white' && trackIndex === 0) {
        ctx.advanceTrack(6); // Plant track = index 6
        ctx.gameLog('MarsBot (Recyclone): white cube on building track — advance plant track');
      }
    },
  },
};

// C24 Splice
const SPLICE: IMarsBotCorp = {
  name: CardName.SPLICE,
  description: 'Tag: Plant. Draft: Microbe. Setup: +8 MC, remove R&D. Microbe cards earn 4 MC. When human plays a Microbe card, earn 2 MC.',
  startingTags: [Tag.PLANT],
  draftPriority: {type: 'tags', tags: [Tag.MICROBE]},
  setup: {
    resolve(ctx) {
      ctx.gainMc(8);
      ctx.removeBonusCardFromDeck(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT);
      ctx.gameLog('MarsBot (Splice): +8 M€, R&D removed, microbe card added to bonus deck');
    },
  },
  effect: {
    onProjectCardResolved(ctx, card) {
      if (card.tags.includes(Tag.MICROBE)) {
        ctx.gainMc(4);
        ctx.gameLog('MarsBot (Splice): microbe card, +4 M€');
      }
    },
    onHumanCardPlayed(ctx, card) {
      if (card.tags.includes(Tag.MICROBE)) {
        ctx.gainMc(2);
        ctx.gameLog('MarsBot (Splice): human played microbe, +2 M€');
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
