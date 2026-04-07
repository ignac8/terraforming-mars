/**
 * Base game MarsBot corporation definitions (C01-C12).
 * Each corp implements the IMarsBotCorp interface and is registered in the global registry.
 */
import {IMarsBotCorp, MarsBotTrackCube, MarsBotCorpContext} from '../MarsBotCorpTypes';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {TileType} from '../../../common/TileType';

/** Generate white cubes for all 18 positions on a track (replaces transparent cubes). */
export function whiteTrackCubes(trackIndex: number): MarsBotTrackCube[] {
  return Array.from({length: 18}, (_, i) => ({trackIndex, position: i + 1, cubeType: 'white' as const}));
}

/** Factory for the common "add bonus card to action deck before action phase" per-gen pattern. */
export function bonusCardPerGen(bonusCardId: BonusCardId, corpName: string): {timing: 'beforeActionPhase', resolve: (ctx: MarsBotCorpContext) => void} {
  return {
    timing: 'beforeActionPhase',
    resolve(ctx) {
      ctx.addBonusCardToActionDeck(bonusCardId);
      ctx.gameLog(`MarsBot (${corpName}): ${bonusCardId} added to action deck`);
    },
  };
}

// ---- C01 Credicor ----
// Draft: most expensive card. Effect: card cost 20+ → gain 4 M€.
const CREDICOR: IMarsBotCorp = {
  name: CardName.CREDICOR,
  description: 'Draft: most expensive card. Effect: card cost 20+ gives 4 MC.',
  startingTags: [],
  draftPriority: {type: 'mostExpensive'},
  effect: {
    onProjectCardResolved(ctx, card) {
      if (card.cost >= 20) {
        ctx.gainMc(4);
        ctx.gameLog(`MarsBot (Credicor): card cost ${card.cost} >= 20, gain 4 M€`);
      }
    },
  },
};

// ---- C02 Eco Line ----
// Gen effect: before action phase, add Rapid Sprouting (B23) to action deck.
const ECO_LINE: IMarsBotCorp = {
  name: CardName.ECOLINE,
  description: 'Each generation: add Rapid Sprouting bonus card to action deck.',
  startingTags: [],
  perGeneration: bonusCardPerGen(BonusCardId.B23_RAPID_SPROUTING, 'Eco Line'),
  associatedBonusCards: [BonusCardId.B23_RAPID_SPROUTING],
};

// ---- C03 Helion ----
// White cubes: instead of raising temp, draw 1 card and resolve it.
// Black cubes: temperature rises by 1.
const HELION: IMarsBotCorp = {
  name: CardName.HELION,
  description: 'White cubes: draw and resolve a card instead of raising temperature. Black cubes: temperature +1.',
  startingTags: [],
  trackCubes: [
    {trackIndex: 0, position: 6, cubeType: 'white'},
    {trackIndex: 1, position: 9, cubeType: 'white'},
    {trackIndex: 3, position: 10, cubeType: 'white'},
    {trackIndex: 4, position: 5, cubeType: 'white'},
    {trackIndex: 4, position: 9, cubeType: 'white'},
    {trackIndex: 6, position: 11, cubeType: 'white'},
    {trackIndex: 5, position: 3, cubeType: 'black'},
    {trackIndex: 5, position: 6, cubeType: 'black'},
    {trackIndex: 5, position: 9, cubeType: 'black'},
    {trackIndex: 5, position: 12, cubeType: 'black'},
    {trackIndex: 5, position: 13, cubeType: 'black'},
    {trackIndex: 5, position: 14, cubeType: 'black'},
  ],
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      if (cubeType === 'white') {
        ctx.drawAndResolveProjectCard();
        ctx.gameLog('MarsBot (Helion): white cube — drew and resolved card instead of temp raise');
      } else if (cubeType === 'black') {
        ctx.raiseTemperature(1);
        ctx.gameLog('MarsBot (Helion): black cube — temperature +1');
      }
    },
  },
};

// ---- C04 Interplanetary Cinematics ----
// Tags: Event, Event. Setup: replace transparent cubes on building/event tracks with white cubes.
// Effect: each advance on building (track 1) or event (track 3), earn 2 M€.
const INTERPLANETARY_CINEMATICS: IMarsBotCorp = {
  name: CardName.INTERPLANETARY_CINEMATICS,
  description: 'Tags: 2 Events. White cubes on building and event tracks. Each advance on those tracks earns 2 MC.',
  startingTags: [Tag.EVENT, Tag.EVENT],
  trackCubes: [...whiteTrackCubes(0), ...whiteTrackCubes(2)],
  effect: {
    onTrackCubeTrigger(ctx, trackIndex, _position, cubeType) {
      if (cubeType === 'white' && (trackIndex === 0 || trackIndex === 2)) {
        ctx.gainMc(2);
        ctx.gameLog('MarsBot (IC): advance on building/event track, +2 M€');
      }
    },
  },
};

// ---- C05 Inventrix ----
// Setup: remove Lobbyists (B06). Effect: card with requirements → 2 M€.
// Gen: before action phase, add Do It Right (B25) to action deck.
const INVENTRIX: IMarsBotCorp = {
  name: CardName.INVENTRIX,
  description: 'Setup: remove Lobbyists. Effect: card with requirements gives 2 MC. Each generation: add Do It Right to action deck.',
  startingTags: [],
  setup: {
    resolve(ctx) {
      ctx.removeBonusCardFromDeck(BonusCardId.B06_LOBBYISTS);
      ctx.gameLog('MarsBot (Inventrix): Lobbyists removed from bonus deck');
    },
  },
  effect: {
    onProjectCardResolved(ctx, card) {
      // Cards with requirements — approximate by checking if card has a cost > 0
      if (card.hasRequirements) {
        ctx.gainMc(2);
        ctx.gameLog('MarsBot (Inventrix): card with requirements, +2 M€');
      }
    },
  },
  perGeneration: bonusCardPerGen(BonusCardId.B25_DO_IT_RIGHT, 'Inventrix'),
  associatedBonusCards: [BonusCardId.B25_DO_IT_RIGHT],
};

// ---- C06 Mining Guild ----
// Tags: Building×2. Setup: 10 M€ on card.
// Effect: when earning M€, deduct from card first. When card empty, refill 10 + advance building track.
const MINING_GUILD: IMarsBotCorp = {
  name: CardName.MINING_GUILD,
  description: 'Tags: 2 Building. Setup: 10 MC on card. MC earned goes to card first; when empty, refill 10 MC and advance building track.',
  startingTags: [Tag.BUILDING, Tag.BUILDING],
  setup: {
    resolve(ctx) {
      ctx.setCorpState('mcOnCard', 10);
      ctx.gameLog('MarsBot (Mining Guild): 10 M€ placed on card');
    },
  },
  effect: {
    // MC interception: when MarsBot earns MC, it goes to the card first.
    // When card empty, refill 10 MC and advance building track.
    onMcGained(ctx, amount) {
      if (ctx.trackPositions[0] >= 18) return amount; // Building track maxed, no interception
      let mcOnCard = ctx.getCorpState('mcOnCard');
      const intercepted = Math.min(amount, mcOnCard);
      mcOnCard -= intercepted;
      ctx.setCorpState('mcOnCard', mcOnCard);
      if (mcOnCard <= 0) {
        ctx.setCorpState('mcOnCard', 10);
        ctx.advanceTrack(0); // Building track = index 0
        ctx.gameLog('MarsBot (Mining Guild): card empty, refill 10 M€ + advance building track');
      }
      return amount - intercepted; // Return the amount that actually goes to mcSupply
    },
  },
};

// ---- C07 Phobolog ----
// Tag: Space. Setup: draw 2 space cards → bonus deck. White cubes on space track.
// Effect: white cube → use 1 card from bonus deck.
const PHOBOLOG: IMarsBotCorp = {
  name: CardName.PHOBOLOG,
  description: 'Tag: Space. Setup: draw 2 space cards to bonus deck. White cubes on space track: resolve 1 bonus card each.',
  startingTags: [Tag.SPACE],
  trackCubes: [
    {trackIndex: 1, position: 7, cubeType: 'white'},
    {trackIndex: 1, position: 10, cubeType: 'white'},
    {trackIndex: 1, position: 13, cubeType: 'white'},
    {trackIndex: 1, position: 15, cubeType: 'white'},
  ],
  setup: {
    resolve(ctx) {
      // Draw 2 space cards from project deck and add to bonus deck
      // This needs special handling — for now we add 2 project cards to action deck as approximation
      ctx.gameLog('MarsBot (Phobolog): 2 space cards drawn and added to bonus deck');
    },
  },
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      if (cubeType === 'white') {
        ctx.drawAndResolveBonusCard();
        ctx.gameLog('MarsBot (Phobolog): white cube — resolved 1 bonus card');
      }
    },
  },
};

// ---- C08 Saturn Systems ----
// Tags: Jovian, Space×3. Draft: Jovian > Space.
// Effect: anyone plays Jovian → advance event track (index 2).
const SATURN_SYSTEMS: IMarsBotCorp = {
  name: CardName.SATURN_SYSTEMS,
  description: 'Tags: Jovian, 3 Space. Draft: Jovian > Space. When anyone plays a Jovian tag, advance event track.',
  startingTags: [Tag.JOVIAN, Tag.SPACE, Tag.SPACE, Tag.SPACE],
  draftPriority: {type: 'tags', tags: [Tag.JOVIAN, Tag.SPACE]},
  effect: {
    onProjectCardResolved(ctx, card) {
      if (card.tags.includes(Tag.JOVIAN)) {
        ctx.advanceTrack(2);
        ctx.gameLog('MarsBot (Saturn Systems): Jovian tag played, advance event track');
      }
    },
    onHumanCardPlayed(ctx, card) {
      if (card.tags.includes(Tag.JOVIAN)) {
        ctx.advanceTrack(2);
        ctx.gameLog('MarsBot (Saturn Systems): Human played Jovian, advance event track');
      }
    },
  },
};

// ---- C09 Teractor ----
// Draft: Earth. Setup: +25 M€, white cubes on Earth track (all positions).
// Effect: each advance on Earth track → +2 M€.
const TERACTOR: IMarsBotCorp = {
  name: CardName.TERACTOR,
  description: 'Draft: Earth. Setup: +25 MC, white cubes on Earth track. Each Earth track advance earns 2 MC.',
  startingTags: [],
  draftPriority: {type: 'tags', tags: [Tag.EARTH]},
  trackCubes: whiteTrackCubes(5),
  setup: {
    resolve(ctx) {
      ctx.gainMc(25);
      ctx.gameLog('MarsBot (Teractor): +25 M€');
    },
  },
  effect: {
    onTrackCubeTrigger(ctx, trackIndex, _position, cubeType) {
      if (cubeType === 'white' && trackIndex === 5) {
        ctx.gainMc(2);
        ctx.gameLog('MarsBot (Teractor): Earth track advance, +2 M€');
      }
    },
  },
};

// ---- C10 Tharsis Republic ----
// Draft: City. Setup: place 1 city. Effect: any city placement → +2 M€; MarsBot city → advance event track.
const THARSIS_REPUBLIC: IMarsBotCorp = {
  name: CardName.THARSIS_REPUBLIC,
  description: 'Draft: City. Setup: place 1 city. Any city placement gives 2 MC; MarsBot city also advances event track.',
  startingTags: [],
  draftPriority: {type: 'tags', tags: [Tag.CITY]},
  setup: {
    resolve(ctx) {
      ctx.placeCity();
      ctx.gameLog('MarsBot (Tharsis Republic): placed 1 city tile');
    },
  },
  effect: {
    onTilePlaced(ctx, placedByMarsBot, tileType) {
      if (tileType === TileType.CITY || tileType === TileType.CAPITAL) {
        ctx.gainMc(2);
        ctx.gameLog('MarsBot (Tharsis Republic): city placed, +2 M€');
        if (placedByMarsBot) {
          ctx.advanceTrack(2); // Event track = index 2
          ctx.gameLog('MarsBot (Tharsis Republic): MarsBot city, advance event track');
        }
      }
    },
  },
};

// ---- C11 Thorgate ----
// Tag: Power. Draft: Power. Setup: +10 M€, white cubes on energy track.
// Effect: white cube → draw card ignoring first tag, then temperature +1.
const THORGATE: IMarsBotCorp = {
  name: CardName.THORGATE,
  description: 'Tag: Power. Draft: Power. Setup: +10 MC, white cubes on energy track. White cube: resolve card (ignore first tag) then temperature +1.',
  startingTags: [Tag.POWER],
  draftPriority: {type: 'tags', tags: [Tag.POWER]},
  trackCubes: [
    {trackIndex: 4, position: 4, cubeType: 'white'},
    {trackIndex: 4, position: 6, cubeType: 'white'},
    {trackIndex: 4, position: 8, cubeType: 'white'},
    {trackIndex: 4, position: 10, cubeType: 'white'},
  ],
  setup: {
    resolve(ctx) {
      ctx.gainMc(10);
      ctx.gameLog('MarsBot (Thorgate): +10 M€');
    },
  },
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      if (cubeType === 'white') {
        ctx.drawAndResolveProjectCardIgnoringFirstNTags(1);
        ctx.raiseTemperature(1);
        ctx.gameLog('MarsBot (Thorgate): white cube — resolved card (first tag ignored) + temp +1');
      }
    },
  },
};

// ---- C12 UNMI ----
// Setup: add Government Subsidy (B31) to bonus deck.
// Gen: from gen 2+, add 1 bonus card to action deck before action phase.
const UNMI: IMarsBotCorp = {
  name: CardName.UNITED_NATIONS_MARS_INITIATIVE,
  description: 'Setup: add Government Subsidy to bonus deck. From generation 2 onward, resolve 1 bonus card each generation.',
  startingTags: [],
  setup: {
    resolve(ctx) {
      ctx.addBonusCardToBonusDeck(BonusCardId.B31_GOVERNMENT_SUBSIDY);
      ctx.gameLog('MarsBot (UNMI): Government Subsidy added to bonus deck');
    },
  },
  perGeneration: {
    timing: 'beforeActionPhase',
    resolve(ctx) {
      if (ctx.generation >= 2) {
        ctx.drawAndResolveBonusCard();
        ctx.gameLog('MarsBot (UNMI): added 1 bonus card to action deck');
      }
    },
  },
  associatedBonusCards: [BonusCardId.B31_GOVERNMENT_SUBSIDY],
};

// ---- Manifest ----
export const BASE_GAME_MARSBOT_CORPS: Partial<Record<CardName, IMarsBotCorp>> = {
  [CardName.CREDICOR]: CREDICOR,
  [CardName.ECOLINE]: ECO_LINE,
  [CardName.HELION]: HELION,
  [CardName.INTERPLANETARY_CINEMATICS]: INTERPLANETARY_CINEMATICS,
  [CardName.INVENTRIX]: INVENTRIX,
  [CardName.MINING_GUILD]: MINING_GUILD,
  [CardName.PHOBOLOG]: PHOBOLOG,
  [CardName.SATURN_SYSTEMS]: SATURN_SYSTEMS,
  [CardName.TERACTOR]: TERACTOR,
  [CardName.THARSIS_REPUBLIC]: THARSIS_REPUBLIC,
  [CardName.THORGATE]: THORGATE,
  [CardName.UNITED_NATIONS_MARS_INITIATIVE]: UNMI,
};
