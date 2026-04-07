import {IMarsBotCorp} from '../MarsBotCorpTypes';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {AutomaManifest} from './AutomaManifest';
import {whiteTrackCubes, bonusCardPerGen, whiteLeastBlackSpaceHandler} from './BaseGameCorps';

// ==== PRELUDE (C13-C17) ====

// C13 Cheung Shing MARS — credit cubes on building track from position 4
const CHEUNG_SHING_MARS: IMarsBotCorp = {
  name: CardName.CHEUNG_SHING_MARS,
  description: 'Tag: Building. Draft: Building. Credit cubes on building track from position 4; each earns 1 MC.',
  startingTags: [Tag.BUILDING],
  draftPriority: {type: 'tags', tags: [Tag.BUILDING]},
  // Credit cubes at positions 4-18 on building track (track 1)
  trackCubes: Array.from({length: 15}, (_, i) => ({trackIndex: 0, position: i + 4, cubeType: 'credit' as const})),
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      if (cubeType === 'credit') {
        ctx.gainMc(1);
        ctx.gameLog('MarsBot (Cheung Shing): credit cube reached, +1 M€');
      }
    },
  },
};

// C14 Point Luna — white+black cubes on Earth track (track 6)
const POINT_LUNA: IMarsBotCorp = {
  name: CardName.POINT_LUNA,
  description: 'Tag: Space. Draft: Earth. White and black cubes on Earth track. White: advance least-advanced track. Black: advance space track.',
  startingTags: [Tag.SPACE],
  draftPriority: {type: 'tags', tags: [Tag.EARTH]},
  trackCubes: [
    {trackIndex: 5, position: 1, cubeType: 'white'},
    {trackIndex: 5, position: 5, cubeType: 'white'},
    {trackIndex: 5, position: 9, cubeType: 'white'},
    {trackIndex: 5, position: 13, cubeType: 'white'},
    {trackIndex: 5, position: 17, cubeType: 'white'},
    {trackIndex: 5, position: 3, cubeType: 'black'},
    {trackIndex: 5, position: 7, cubeType: 'black'},
    {trackIndex: 5, position: 11, cubeType: 'black'},
    {trackIndex: 5, position: 15, cubeType: 'black'},
  ],
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      whiteLeastBlackSpaceHandler(ctx, cubeType, 'Point Luna');
    },
  },
};

// C15 Robinson Industries
const ROBINSON_INDUSTRIES: IMarsBotCorp = {
  name: CardName.ROBINSON_INDUSTRIES,
  description: 'Setup: +10 MC. Each generation: add Diversification bonus card to action deck.',
  startingTags: [],
  setup: {
    resolve(ctx) {
      ctx.gainMc(10);
      ctx.gameLog('MarsBot (Robinson Industries): +10 M€');
    },
  },
  perGeneration: bonusCardPerGen(BonusCardId.B28_DIVERSIFICATION, 'Robinson Industries'),
  associatedBonusCards: [BonusCardId.B28_DIVERSIFICATION],
};

// C16 Valley Trust
const VALLEY_TRUST: IMarsBotCorp = {
  name: CardName.VALLEY_TRUST,
  description: 'Draft: Science. Setup: draw 1 card. White cubes on science track: draw and resolve a card each.',
  startingTags: [],
  draftPriority: {type: 'tags', tags: [Tag.SCIENCE]},
  setup: {
    resolve(ctx) {
      ctx.addProjectCardToActionDeck(1); // "Obtain 1 card"
      ctx.gameLog('MarsBot (Valley Trust): drew 1 card');
    },
  },
  trackCubes: [
    {trackIndex: 3, position: 8, cubeType: 'white'},
    {trackIndex: 3, position: 16, cubeType: 'white'},
  ],
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      if (cubeType === 'white') {
        ctx.drawAndResolveProjectCard();
        ctx.gameLog('MarsBot (Valley Trust): white cube — drew and resolved 1 card');
      }
    },
  },
};

// C17 Vitor — separates B04, adds it to action deck each gen
const VITOR: IMarsBotCorp = {
  name: CardName.VITOR,
  description: 'Setup: separate Overachievement from bonus deck. Cards with non-negative VP earn 3 MC. Each generation: add Overachievement to action deck.',
  startingTags: [],
  setup: {
    resolve(ctx) {
      ctx.removeBonusCardFromDeck(BonusCardId.B04_OVERACHIEVEMENT);
      ctx.gameLog('MarsBot (Vitor): Overachievement separated from bonus deck');
    },
  },
  effect: {
    onProjectCardResolved(ctx, card) {
      if (card.victoryPoints > 0) {
        ctx.gainMc(3);
        ctx.gameLog('MarsBot (Vitor): non-negative VP card, +3 M€');
      }
    },
  },
  perGeneration: bonusCardPerGen(BonusCardId.B04_OVERACHIEVEMENT, 'Vitor'),
};

// ==== PRELUDE 2 (C18, C20, C29, C40-C46) ====

// C18 Acadian Community
const ACADIAN_COMMUNITY: IMarsBotCorp = {
  name: CardName.ARCADIAN_COMMUNITIES,
  description: 'Tag: Building. Setup: resolve Settlers immediately. Each generation: add Settlers to action deck.',
  startingTags: [Tag.BUILDING],
  setup: {
    resolve(ctx) {
      ctx.addBonusCardToActionDeck(BonusCardId.B22_SETTLERS);
      ctx.gameLog('MarsBot (Acadian Community): Settlers resolved immediately');
    },
  },
  effect: {
    // Every time MarsBot places a tile on a space with its marker -> 3 MC
    // Needs onTilePlaced hook
  },
  perGeneration: bonusCardPerGen(BonusCardId.B22_SETTLERS, 'Acadian Community'),
  associatedBonusCards: [BonusCardId.B22_SETTLERS],
};

// C19 Astrodrill Enterprise — white+black cubes on space track
const ASTRODRILL_ENTERPRISE: IMarsBotCorp = {
  name: CardName.ASTRODRILL,
  description: 'Draft: Space. White and black cubes on space track. White: advance least-advanced track. Black: advance space track.',
  startingTags: [],
  draftPriority: {type: 'tags', tags: [Tag.SPACE]},
  trackCubes: [
    {trackIndex: 1, position: 2, cubeType: 'white'},
    {trackIndex: 1, position: 4, cubeType: 'white'},
    {trackIndex: 1, position: 7, cubeType: 'white'},
    {trackIndex: 1, position: 10, cubeType: 'white'},
    {trackIndex: 1, position: 13, cubeType: 'white'},
    {trackIndex: 1, position: 5, cubeType: 'black'},
    {trackIndex: 1, position: 11, cubeType: 'black'},
    {trackIndex: 1, position: 16, cubeType: 'black'},
  ],
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      whiteLeastBlackSpaceHandler(ctx, cubeType, 'Astrodrill');
    },
  },
};

// C20 Factorum
const FACTORUM: IMarsBotCorp = {
  name: CardName.FACTORUM,
  description: 'Tag: Power. White cubes on building track: each advance stores 1 MC on card. Each generation: add Supply and Demand to action deck.',
  startingTags: [Tag.POWER],
  trackCubes: whiteTrackCubes(0),
  effect: {
    onTrackCubeTrigger(ctx, trackIndex, _position, cubeType) {
      if (cubeType === 'white' && trackIndex === 0) {
        const mc = ctx.getCorpState('mcOnCard') + 1;
        ctx.setCorpState('mcOnCard', mc);
        ctx.gameLog(`MarsBot (Factorum): building track advance, +1 M€ on card (${mc} total)`);
      }
    },
  },
  perGeneration: bonusCardPerGen(BonusCardId.B24_SUPPLY_AND_DEMAND, 'Factorum'),
  associatedBonusCards: [BonusCardId.B24_SUPPLY_AND_DEMAND],
};

// C29 Manutech — black cubes at #5/#12 on each track
const MANUTECH: IMarsBotCorp = {
  name: CardName.MANUTECH,
  description: 'Tag: Building. Black cubes at positions 5 and 12 on every track. Hitting a black cube advances that same track 1 extra step.',
  startingTags: [Tag.BUILDING],
  trackCubes: Array.from({length: 7}, (_, i) => [
    {trackIndex: i, position: 5, cubeType: 'black' as const},
    {trackIndex: i, position: 12, cubeType: 'black' as const},
  ]).flat(),
  effect: {
    onTrackCubeTrigger(ctx, trackIndex, _position, cubeType) {
      if (cubeType === 'black') {
        ctx.advanceTrack(trackIndex); // Advance same track 1 more
        ctx.gameLog(`MarsBot (Manutech): black cube on track ${trackIndex} — advance 1 more`);
      }
    },
  },
};

// C40 Ecotec
const ECOTEC: IMarsBotCorp = {
  name: CardName.ECOTEC,
  description: 'Tag: Plant. Draft: Plant > Microbe > Animal. Setup: 2 plant resources on card. Plant/Microbe/Animal cards add 1 plant resource; spend 5 to advance plant track.',
  startingTags: [Tag.PLANT],
  draftPriority: {type: 'tags', tags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]},
  trackCubes: whiteTrackCubes(6),
  setup: {
    resolve(ctx) {
      ctx.setCorpState('plantResources', 2);
      ctx.gameLog('MarsBot (Ecotec): 2 plant resources on card');
    },
  },
  effect: {
    onProjectCardResolved(ctx, card) {
      if (card.tags.some((t) => t === Tag.PLANT || t === Tag.MICROBE || t === Tag.ANIMAL)) {
        ctx.setCorpState('plantResources', ctx.getCorpState('plantResources') + 1);
        ctx.gameLog('MarsBot (Ecotec): Plant/Microbe/Animal card, +1 plant resource on card');
      }
    },
  },
  perGeneration: {
    timing: 'beforeActionPhase',
    resolve(ctx) {
      const plants = ctx.getCorpState('plantResources');
      if (plants >= 5) {
        ctx.setCorpState('plantResources', plants - 5);
        ctx.advanceTrack(6); // Plant track = index 6
        ctx.gameLog('MarsBot (Ecotec): spent 5 plant resources, advance plant track');
      }
    },
  },
};

// C41 Kuiper Cooperative
const KUIPER_COOPERATIVE: IMarsBotCorp = {
  name: CardName.KUIPER_COOPERATIVE,
  description: 'Tag: Space. Draft: Space. White and black cubes on space track. White: temperature +1. Black: place ocean.',
  startingTags: [Tag.SPACE],
  draftPriority: {type: 'tags', tags: [Tag.SPACE]},
  trackCubes: [
    {trackIndex: 1, position: 4, cubeType: 'white'},
    {trackIndex: 1, position: 8, cubeType: 'white'},
    {trackIndex: 1, position: 12, cubeType: 'white'},
    {trackIndex: 1, position: 7, cubeType: 'black'},
    {trackIndex: 1, position: 10, cubeType: 'black'},
    {trackIndex: 1, position: 14, cubeType: 'black'},
  ],
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      if (cubeType === 'white') {
        ctx.raiseTemperature(1);
        ctx.gameLog('MarsBot (Kuiper): white cube — temperature +1');
      } else if (cubeType === 'black') {
        ctx.placeOcean();
        ctx.gameLog('MarsBot (Kuiper): black cube — place ocean');
      }
    },
  },
};

// C42 Nirgal Enterprises
const NIRGAL_ENTERPRISES: IMarsBotCorp = {
  name: CardName.NIRGAL_ENTERPRISES,
  description: 'Tags: Building, Power, Plant. Setup: remove Overachievement. Generations 2-5 and 10+: claim milestone. Generations 6-9: fund award.',
  startingTags: [Tag.BUILDING, Tag.POWER, Tag.PLANT],
  setup: {
    resolve(ctx) {
      ctx.removeBonusCardFromDeck(BonusCardId.B04_OVERACHIEVEMENT);
      ctx.gameLog('MarsBot (Nirgal): Overachievement removed from bonus deck');
    },
  },
  // effect: +2 in all corporate awards — needs award scoring integration
  perGeneration: {
    timing: 'beforeActionPhase',
    resolve(ctx) {
      // Gen 2-5 or 10+: claim milestone. Gen 6-9: fund award.
      if ((ctx.generation >= 2 && ctx.generation <= 5) || ctx.generation >= 10) {
        ctx.gameLog('MarsBot (Nirgal): attempt milestone claim');
        // Milestone claiming is handled by the track action system
      } else if (ctx.generation >= 6 && ctx.generation <= 9) {
        ctx.gameLog('MarsBot (Nirgal): attempt award funding');
        // Award funding is handled by the track action system
      }
    },
  },
};

// C43 Paladin Shipping
const PALADIN_SHIPPING: IMarsBotCorp = {
  name: CardName.PALLADIN_SHIPPING,
  description: 'Tags: Space, Event. Draft: Space > Event. Setup: +5 MC. Cubes on space and event tracks are collected; when a white and black pair is collected, temperature +1.',
  startingTags: [Tag.SPACE, Tag.EVENT],
  draftPriority: {type: 'tags', tags: [Tag.SPACE, Tag.EVENT]},
  setup: {
    resolve(ctx) {
      ctx.gainMc(5);
      ctx.gameLog('MarsBot (Paladin): +5 M€');
    },
  },
  trackCubes: [
    {trackIndex: 1, position: 3, cubeType: 'white'},
    {trackIndex: 1, position: 4, cubeType: 'white'},
    {trackIndex: 1, position: 6, cubeType: 'white'},
    {trackIndex: 1, position: 8, cubeType: 'white'},
    {trackIndex: 1, position: 10, cubeType: 'white'},
    {trackIndex: 1, position: 11, cubeType: 'white'},
    {trackIndex: 2, position: 3, cubeType: 'black'},
    {trackIndex: 2, position: 4, cubeType: 'black'},
    {trackIndex: 2, position: 6, cubeType: 'black'},
    {trackIndex: 2, position: 8, cubeType: 'black'},
    {trackIndex: 2, position: 10, cubeType: 'black'},
    {trackIndex: 2, position: 11, cubeType: 'black'},
  ],
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      // Collect cube onto card. If 2 colors present, remove pair + temp +1
      const key = cubeType === 'white' ? 'whiteCubesOnCard' : 'blackCubesOnCard';
      ctx.setCorpState(key, ctx.getCorpState(key) + 1);
      const white = ctx.getCorpState('whiteCubesOnCard');
      const black = ctx.getCorpState('blackCubesOnCard');
      if (white > 0 && black > 0) {
        ctx.setCorpState('whiteCubesOnCard', white - 1);
        ctx.setCorpState('blackCubesOnCard', black - 1);
        ctx.raiseTemperature(1);
        ctx.gameLog('MarsBot (Paladin): paired cubes — temperature +1');
      } else {
        ctx.gameLog(`MarsBot (Paladin): ${cubeType} cube collected (W:${ctx.getCorpState('whiteCubesOnCard')}, B:${ctx.getCorpState('blackCubesOnCard')})`);
      }
    },
  },
};

// C44 Sagitta
const SAGITTA: IMarsBotCorp = {
  name: CardName.SAGITTA_FRONTIER_SERVICES,
  description: 'Tags: Power, Event. Setup: +8 MC. Tagless cards earn 10 MC instead of 5. 1-tag cards earn 1 extra MC.',
  startingTags: [Tag.POWER, Tag.EVENT],
  setup: {
    resolve(ctx) {
      ctx.gainMc(8);
      ctx.gameLog('MarsBot (Sagitta): +8 M€');
    },
  },
  effect: {
    // Tagless card: 10 MC instead of 5 (Failed Action). 1-tag card: +1 MC.
    onProjectCardResolved(ctx, card) {
      if (card.tags.length === 0) {
        // Failed action gives 10 instead of 5 — difference of 5 on top of normal
        ctx.gainMc(5);
        ctx.gameLog('MarsBot (Sagitta): tagless card, +5 M€ extra (10 total)');
      } else if (card.tags.length === 1) {
        ctx.gainMc(1);
        ctx.gameLog('MarsBot (Sagitta): 1-tag card, +1 M€');
      }
    },
  },
};

// C45 Spire
const SPIRE: IMarsBotCorp = {
  name: CardName.SPIRE,
  description: 'Tag: Earth. Draft: card with most tags. Cards with 2+ tags add 1 science resource. Spend 10 science to place a city and gain 1 TR.',
  startingTags: [Tag.EARTH],
  draftPriority: {type: 'mostTags'},
  effect: {
    onProjectCardResolved(ctx, card) {
      const nonWildTags = card.tags.filter((t) => t !== Tag.WILD);
      if (nonWildTags.length >= 2) {
        ctx.setCorpState('scienceResources', ctx.getCorpState('scienceResources') + 1);
        ctx.gameLog(`MarsBot (Spire): card with ${nonWildTags.length} tags, +1 science resource`);
      }
    },
  },
  perGeneration: {
    timing: 'beforeActionPhase',
    resolve(ctx) {
      const science = ctx.getCorpState('scienceResources');
      if (science >= 10) {
        ctx.setCorpState('scienceResources', science - 10);
        ctx.placeCity();
        ctx.raiseTR(1);
        ctx.gameLog('MarsBot (Spire): spent 10 science, placed city + TR +1');
      }
    },
  },
};

// C46 Tyco Magnetics
const TYCO_MAGNETICS: IMarsBotCorp = {
  name: CardName.TYCHO_MAGNETICS,
  description: 'Draft: Power > Science. Setup: add Interface Hyperlink to bonus deck.',
  startingTags: [],
  draftPriority: {type: 'tags', tags: [Tag.POWER, Tag.SCIENCE]},
  setup: {
    resolve(ctx) {
      ctx.addBonusCardToBonusDeck(BonusCardId.B30_INTERFACE_HYPERLINK);
      ctx.gameLog('MarsBot (Tyco Magnetics): Interface Hyperlink added to bonus deck');
    },
  },
  associatedBonusCards: [BonusCardId.B30_INTERFACE_HYPERLINK],
};

export const AUTOMA_PRELUDE_MANIFEST: AutomaManifest = {
  corps: {
    // Prelude
    [CardName.CHEUNG_SHING_MARS]: CHEUNG_SHING_MARS,
    [CardName.POINT_LUNA]: POINT_LUNA,
    [CardName.ROBINSON_INDUSTRIES]: ROBINSON_INDUSTRIES,
    [CardName.VALLEY_TRUST]: VALLEY_TRUST,
    [CardName.VITOR]: VITOR,
    // Prelude 2
    [CardName.ARCADIAN_COMMUNITIES]: ACADIAN_COMMUNITY,
    [CardName.ASTRODRILL]: ASTRODRILL_ENTERPRISE,
    [CardName.FACTORUM]: FACTORUM,
    [CardName.MANUTECH]: MANUTECH,
    [CardName.ECOTEC]: ECOTEC,
    [CardName.KUIPER_COOPERATIVE]: KUIPER_COOPERATIVE,
    [CardName.NIRGAL_ENTERPRISES]: NIRGAL_ENTERPRISES,
    [CardName.PALLADIN_SHIPPING]: PALADIN_SHIPPING,
    [CardName.SAGITTA_FRONTIER_SERVICES]: SAGITTA,
    [CardName.SPIRE]: SPIRE,
    [CardName.TYCHO_MAGNETICS]: TYCO_MAGNETICS,
  },
};
