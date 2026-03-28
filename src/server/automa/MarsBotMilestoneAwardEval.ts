import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';

/**
 * Context provided to milestone/award evaluation functions for MarsBot.
 */
export interface MarsBotMAContext {
  /** Track positions (0-based index, 7 tracks). Track 1=Building, 2=Space, 3=Event, 4=Science, 5=Energy, 6=Earth, 7=Plant/Animal/Microbe */
  trackPos: (trackNum: number) => number; // 1-based track number
  /** All track positions as array */
  allTrackPositions: () => ReadonlyArray<number>;
  tr: number;
  mc: number;
  cityCount: number;
  greeneryCount: number;
  oceanCount: number; // oceans placed by MarsBot
  tilesOwned: number;
  tilesAdjacentToOcean: number;
  tilesOnEdge: number;
  tilesNotAdjacentToOcean: number;
  /** Cards in MarsBot's played pile */
  playedCards: {
    total: number;
    green: number; // green cards (active)
    blue: number; // blue cards (automated)
    red: number; // red cards (events)
    greenOrBlue: number;
    withoutTags: number;
    costing20Plus: number; // including events
    costing10OrLess: number; // including events
    withNonNegativeVP: number;
    withRequirements: number;
  };
  destroyedBonusCards: number;
  temperatureRaises: number; // times MarsBot raised temperature
  /** Highest track position (excluding Venus if not enabled) */
  highestTrackPos: number;
  /** Lowest track position (excluding Venus if not enabled) */
  lowestTrackPos: number;
  /** Number of tracks at or above a given position */
  tracksAtOrAbove: (pos: number) => number;
  /** Connected tile group size (for Landscaper) */
  largestConnectedTileGroup: number;
  /** Special tiles owned (for Founder) */
  specialTilesOwned: number;
  /** Has Venus track */
  hasVenus: boolean;
  /** Venus track position (0 if no Venus) */
  venusTrackPos: number;
}

/**
 * Context provided to Corporate Competition helper functions.
 */
export interface MarsBotCCContext {
  // Placeholder - will be expanded with game state access as needed
}

export type CorporateCompetitionHelper = (ctx: MarsBotCCContext) => void;

// Sentinel value meaning "use the default/fallback evaluation"
const FALLBACK = undefined;

/**
 * Milestone evaluation functions for MarsBot.
 *
 * Returns true if MarsBot qualifies for the milestone, false if not,
 * or undefined to indicate fallback to the default game evaluation.
 */
export const MILESTONE_EVALS: Partial<Record<MilestoneName, (ctx: MarsBotMAContext) => boolean | undefined>> = {
  // === Tharsis ===
  'Terraformer': (ctx) => ctx.tr >= 35,
  'Mayor': (ctx) => ctx.cityCount >= 3,
  'Gardener': (ctx) => ctx.greeneryCount >= 3,
  'Builder': (ctx) => ctx.trackPos(1) >= 8,
  'Planner': (ctx) => {
    // All non-Venus tracks position >= 4
    for (let t = 1; t <= 7; t++) {
      if (ctx.trackPos(t) < 4) return false;
    }
    return true;
  },

  // === Hellas ===
  'Diversifier': (ctx) => {
    // All tracks position >= 3 (including Venus if present)
    for (let t = 1; t <= 7; t++) {
      if (ctx.trackPos(t) < 3) return false;
    }
    if (ctx.hasVenus && ctx.venusTrackPos < 3) return false;
    return true;
  },
  'Tactician': (ctx) => ctx.mc >= 35,
  'Polar Explorer': () => FALLBACK,
  'Energizer': (ctx) => ctx.trackPos(5) >= 6,
  'Rim Settler': (ctx) => ctx.trackPos(2) >= 6 && ctx.trackPos(4) >= 6,

  // === Elysium ===
  'Generalist': (ctx) => {
    // All non-Venus tracks position >= 2
    for (let t = 1; t <= 7; t++) {
      if (ctx.trackPos(t) < 2) return false;
    }
    return true;
  },
  'Specialist': (ctx) => {
    // Any one track position >= 10
    for (let t = 1; t <= 7; t++) {
      if (ctx.trackPos(t) >= 10) return true;
    }
    if (ctx.hasVenus && ctx.venusTrackPos >= 10) return true;
    return false;
  },
  'Ecologist': (ctx) => ctx.trackPos(7) >= 4,
  'Tycoon': (ctx) => ctx.playedCards.greenOrBlue >= 15,
  'Legend': (ctx) => ctx.playedCards.red >= 5,

  // === Terra Cimmeria Nova ===
  'Architect': (ctx) => ctx.trackPos(4) >= 6,
  'Coastguard': (ctx) => ctx.tilesAdjacentToOcean >= 4,
  'C. Forester': (ctx) => ctx.trackPos(7) >= 10,

  // === Vastitas Borealis Nova ===
  'Agronomist': (ctx) => ctx.trackPos(7) >= 4 && ctx.trackPos(4) >= 4,
  'Engineer': (ctx) => ctx.trackPos(5) + ctx.trackPos(4) >= 10,
  'V. Spacefarer': (ctx) => ctx.trackPos(2) >= 5,
  'Geologist': () => FALLBACK,
  'Farmer': (ctx) =>
    (ctx.trackPos(4) >= 6 && ctx.trackPos(3) >= 6) ||
    (ctx.trackPos(7) >= 6 && ctx.trackPos(4) >= 6),

  // === Modular Milestones ===
  'Briber': (ctx) => ctx.mc >= 20,
  'Builder7': (ctx) => ctx.trackPos(1) >= 7,
  'Forester': (ctx) => ctx.trackPos(7) >= 6,
  'Fundraiser': (ctx) => ctx.trackPos(5) >= 8,
  'Hydrologist': (ctx) => ctx.oceanCount >= 4,
  'Landshaper': (ctx) => ctx.cityCount >= 1 && ctx.greeneryCount >= 1 && ctx.trackPos(1) >= 5,
  'Legend4': (ctx) => ctx.playedCards.red >= 4,
  'Lobbyist': () => false,
  'Merchant': (ctx) => {
    // All non-Venus tracks position >= 2
    for (let t = 1; t <= 7; t++) {
      if (ctx.trackPos(t) < 2) return false;
    }
    return true;
  },
  'Metallurgist': (ctx) => ctx.trackPos(1) + ctx.trackPos(2) >= 9,
  'Philantropist': (ctx) => ctx.playedCards.withNonNegativeVP >= 5,
  'Pioneer4': () => FALLBACK,
  'Planetologist': () => false,
  'Producer': (ctx) => {
    // Any 3 non-Venus tracks combined >= 16
    const positions: Array<number> = [];
    for (let t = 1; t <= 7; t++) {
      positions.push(ctx.trackPos(t));
    }
    positions.sort((a, b) => b - a);
    return positions[0] + positions[1] + positions[2] >= 16;
  },
  'Researcher': (ctx) => ctx.trackPos(4) >= 4,
  'Spacefarer4': (ctx) => ctx.trackPos(2) >= 4,
  'Sponsor': (ctx) => ctx.playedCards.costing20Plus >= 3,
  'Tactician4': (ctx) => ctx.mc >= 30,
  'Terraformer29': () => false,
  'Terran5': (ctx) => ctx.trackPos(6) >= 5,
  'Thawer': (ctx) => ctx.temperatureRaises >= 5,
  'Trader': () => false,
  'Tycoon10': (ctx) => ctx.playedCards.greenOrBlue >= 10,
};

/**
 * Award evaluation functions for MarsBot.
 *
 * Returns the numeric score MarsBot would receive for this award,
 * or undefined to indicate fallback to the default game evaluation.
 */
export const AWARD_EVALS: Partial<Record<AwardName, (ctx: MarsBotMAContext) => number | undefined>> = {
  // === Tharsis ===
  'Landlord': (ctx) => ctx.tilesOwned,
  'Banker': (ctx) => ctx.trackPos(1) + ctx.trackPos(3),
  'Scientist': (ctx) => ctx.trackPos(4),
  'Thermalist': (ctx) => ctx.trackPos(5) + 5,
  'Miner': (ctx) => ctx.trackPos(2) + 5,

  // === Hellas ===
  'Cultivator': () => FALLBACK,
  'Magnate': (ctx) => ctx.playedCards.green,
  'Space Baron': (ctx) => ctx.trackPos(2),
  'Excentric': (ctx) => Math.floor(ctx.mc / 5),
  'Contractor': (ctx) => ctx.trackPos(1),

  // === Elysium ===
  'Celebrity': (ctx) => ctx.playedCards.costing20Plus,
  'Industrialist': (ctx) => ctx.trackPos(5) + 5,
  'Desert Settler': () => FALLBACK,
  'Estate Dealer': () => FALLBACK,
  'Benefactor': (ctx) => Math.max(0, ctx.tr - 15),

  // === Terra Cimmeria ===
  'Electrician': (ctx) => ctx.trackPos(5),
  'Founder': () => FALLBACK,
  'Mogul': (ctx) => ctx.highestTrackPos * 2,
  'Zoologist': (ctx) => ctx.trackPos(7) + 5,
  'Forecaster': (ctx) => Math.floor(ctx.mc / 7),

  // === Utopia Planitia (via modular) ===
  'Suburbian': () => FALLBACK,
  'Investor': (ctx) => ctx.trackPos(1) + ctx.trackPos(4),
  'Botanist': (ctx) => Math.max(0, ctx.trackPos(7) - 2),
  'Incorporator': (ctx) => ctx.playedCards.costing10OrLess,
  'Metropolist': () => FALLBACK,

  // === Vastitas Borealis Nova ===
  'Traveller': (ctx) => ctx.trackPos(1) + ctx.trackPos(4) + 5,
  'Landscaper': () => FALLBACK,
  'Highlander': () => FALLBACK,
  'Manufacturer': (ctx) => ctx.trackPos(1) + ctx.trackPos(5),
  'Blacksmith': (ctx) => Math.max(ctx.trackPos(1), ctx.trackPos(2)),

  // === Modular Awards ===
  'Administrator': (ctx) => ctx.playedCards.withoutTags + 2,
  'Collector': (ctx) => ctx.tracksAtOrAbove(3),
  'Constructor': () => FALLBACK,
  'Politician': () => 5,
  'Visionary': (ctx) => ctx.lowestTrackPos * 2,
  'Promoter': (ctx) => ctx.trackPos(5),
};

/**
 * Corporate Competition helper registry.
 *
 * These helpers perform special actions when MarsBot funds an award
 * during the Corporate Competition variant. The actual implementations
 * require game state access and will be filled in as the feature is built.
 */
export const CORPORATE_COMPETITION_HELPERS: Partial<Record<AwardName, CorporateCompetitionHelper>> = {
  'Landlord': (_ctx) => { console.log('Corporate Competition helper not implemented: Landlord'); },
  'Banker': (_ctx) => { console.log('Corporate Competition helper not implemented: Banker'); },
  'Scientist': (_ctx) => { console.log('Corporate Competition helper not implemented: Scientist'); },
  'Thermalist': (_ctx) => { console.log('Corporate Competition helper not implemented: Thermalist'); },
  'Miner': (_ctx) => { console.log('Corporate Competition helper not implemented: Miner'); },
  'Celebrity': (_ctx) => { console.log('Corporate Competition helper not implemented: Celebrity'); },
  'Industrialist': (_ctx) => { console.log('Corporate Competition helper not implemented: Industrialist'); },
  'Desert Settler': (_ctx) => { console.log('Corporate Competition helper not implemented: Desert Settler'); },
  'Estate Dealer': (_ctx) => { console.log('Corporate Competition helper not implemented: Estate Dealer'); },
  'Benefactor': (_ctx) => { console.log('Corporate Competition helper not implemented: Benefactor'); },
  'Contractor': (_ctx) => { console.log('Corporate Competition helper not implemented: Contractor'); },
  'Cultivator': (_ctx) => { console.log('Corporate Competition helper not implemented: Cultivator'); },
  'Excentric': (_ctx) => { console.log('Corporate Competition helper not implemented: Excentric'); },
  'Magnate': (_ctx) => { console.log('Corporate Competition helper not implemented: Magnate'); },
  'Space Baron': (_ctx) => { console.log('Corporate Competition helper not implemented: Space Baron'); },
  'Electrician': (_ctx) => { console.log('Corporate Competition helper not implemented: Electrician'); },
  'Founder': (_ctx) => { console.log('Corporate Competition helper not implemented: Founder'); },
  'Mogul': (_ctx) => { console.log('Corporate Competition helper not implemented: Mogul'); },
  'Zoologist': (_ctx) => { console.log('Corporate Competition helper not implemented: Zoologist'); },
  'Forecaster': (_ctx) => { console.log('Corporate Competition helper not implemented: Forecaster'); },
  'Suburbian': (_ctx) => { console.log('Corporate Competition helper not implemented: Suburbian'); },
  'Investor': (_ctx) => { console.log('Corporate Competition helper not implemented: Investor'); },
  'Botanist': (_ctx) => { console.log('Corporate Competition helper not implemented: Botanist'); },
  'Incorporator': (_ctx) => { console.log('Corporate Competition helper not implemented: Incorporator'); },
  'Metropolist': (_ctx) => { console.log('Corporate Competition helper not implemented: Metropolist'); },
  'Traveller': (_ctx) => { console.log('Corporate Competition helper not implemented: Traveller'); },
  'Landscaper': (_ctx) => { console.log('Corporate Competition helper not implemented: Landscaper'); },
  'Highlander': (_ctx) => { console.log('Corporate Competition helper not implemented: Highlander'); },
  'Manufacturer': (_ctx) => { console.log('Corporate Competition helper not implemented: Manufacturer'); },
  'Blacksmith': (_ctx) => { console.log('Corporate Competition helper not implemented: Blacksmith'); },
  'Administrator': (_ctx) => { console.log('Corporate Competition helper not implemented: Administrator'); },
  'Collector': (_ctx) => { console.log('Corporate Competition helper not implemented: Collector'); },
  'Constructor': (_ctx) => { console.log('Corporate Competition helper not implemented: Constructor'); },
  'Politician': (_ctx) => { console.log('Corporate Competition helper not implemented: Politician'); },
  'Visionary': (_ctx) => { console.log('Corporate Competition helper not implemented: Visionary'); },
  'Promoter': (_ctx) => { console.log('Corporate Competition helper not implemented: Promoter'); },
};
