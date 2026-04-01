import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';

/**
 * Context provided to milestone/award evaluation functions for MarsBot.
 */
export type MarsBotMAContext = {
  trackPos: (trackIndex: number) => number;
  allTrackPositions: () => ReadonlyArray<number>;
  tr: number;
  mc: number;
  cityCount: number;
  greeneryCount: number;
  oceanCount: number;
  tilesOwned: number;
  tilesAdjacentToOcean: number;
  tilesOnEdge: number;
  tilesNotAdjacentToOcean: number;
  playedCards: {
    total: number;
    green: number;
    blue: number;
    red: number;
    greenOrBlue: number;
    withoutTags: number;
    costing20Plus: number;
    costing10OrLess: number;
    withNonNegativeVP: number;
    withRequirements: number;
  };
  destroyedBonusCards: number;
  temperatureRaises: number;
  highestTrackPos: number;
  lowestTrackPos: number;
  tracksAtOrAbove: (pos: number) => number;
  largestConnectedTileGroup: number;
  specialTilesOwned: number;
  hasVenus: boolean;
  venusTrackPos: number;
}

function allTracksAtOrAbove(ctx: MarsBotMAContext, pos: number, includeVenus: boolean): boolean {
  for (let t = 0; t < 7; t++) {
    if (ctx.trackPos(t) < pos) return false;
  }
  if (includeVenus && ctx.hasVenus && ctx.venusTrackPos < pos) return false;
  return true;
}

function anyTrackAtOrAbove(ctx: MarsBotMAContext, pos: number): boolean {
  for (let t = 0; t < 7; t++) {
    if (ctx.trackPos(t) >= pos) return true;
  }
  if (ctx.hasVenus && ctx.venusTrackPos >= pos) return true;
  return false;
}

function topThreeTracksSum(ctx: MarsBotMAContext): number {
  const positions: Array<number> = [];
  for (let t = 0; t < 7; t++) {
    positions.push(ctx.trackPos(t));
  }
  positions.sort((a, b) => b - a);
  return positions[0] + positions[1] + positions[2];
}

/**
 * Milestone evaluation functions for MarsBot.
 * Returns true if MarsBot qualifies, false if not, undefined for fallback to default game evaluation.
 */
export const MILESTONE_EVALS: Map<MilestoneName, (ctx: MarsBotMAContext) => boolean | undefined> = new Map([
  // Tharsis
  ['Terraformer', (ctx) => ctx.tr >= 35],
  ['Mayor', (ctx) => ctx.cityCount >= 3],
  ['Gardener', (ctx) => ctx.greeneryCount >= 3],
  ['Builder', (ctx) => ctx.trackPos(0) >= 8],
  ['Planner', (ctx) => allTracksAtOrAbove(ctx, 4, false)],
  // Hellas
  ['Diversifier', (ctx) => allTracksAtOrAbove(ctx, 3, true)],
  ['Tactician', (ctx) => ctx.mc >= 35],
  ['Polar Explorer', () => undefined],
  ['Energizer', (ctx) => ctx.trackPos(4) >= 6],
  ['Rim Settler', (ctx) => ctx.trackPos(1) >= 6 && ctx.trackPos(3) >= 6],
  // Elysium
  ['Generalist', (ctx) => allTracksAtOrAbove(ctx, 2, false)],
  ['Specialist', (ctx) => anyTrackAtOrAbove(ctx, 10)],
  ['Ecologist', (ctx) => ctx.trackPos(6) >= 4],
  ['Tycoon', (ctx) => ctx.playedCards.greenOrBlue >= 15],
  ['Legend', (ctx) => ctx.playedCards.red >= 5],
  // Terra Cimmeria Nova
  ['Architect', (ctx) => ctx.trackPos(3) >= 6],
  ['Coastguard', (ctx) => ctx.tilesAdjacentToOcean >= 4],
  ['C. Forester', (ctx) => ctx.trackPos(6) >= 10],
  // Vastitas Borealis Nova
  ['Agronomist', (ctx) => ctx.trackPos(6) >= 4 && ctx.trackPos(3) >= 4],
  ['Engineer', (ctx) => ctx.trackPos(4) + ctx.trackPos(3) >= 10],
  ['V. Spacefarer', (ctx) => ctx.trackPos(1) >= 5],
  ['Geologist', () => undefined],
  ['Farmer', (ctx) => (ctx.trackPos(3) >= 6 && ctx.trackPos(2) >= 6) || (ctx.trackPos(6) >= 6 && ctx.trackPos(3) >= 6)],
  // Modular
  ['Briber', (ctx) => ctx.mc >= 20],
  ['Builder7', (ctx) => ctx.trackPos(0) >= 7],
  ['Forester', (ctx) => ctx.trackPos(6) >= 6],
  ['Fundraiser', (ctx) => ctx.trackPos(4) >= 8],
  ['Hydrologist', (ctx) => ctx.oceanCount >= 4],
  ['Landshaper', (ctx) => ctx.cityCount >= 1 && ctx.greeneryCount >= 1 && ctx.trackPos(0) >= 5],
  ['Legend4', (ctx) => ctx.playedCards.red >= 4],
  ['Lobbyist', () => false],
  ['Merchant', (ctx) => allTracksAtOrAbove(ctx, 2, false)],
  ['Metallurgist', (ctx) => ctx.trackPos(0) + ctx.trackPos(1) >= 9],
  ['Philantropist', (ctx) => ctx.playedCards.withNonNegativeVP >= 5],
  ['Pioneer4', () => undefined],
  ['Planetologist', () => false],
  ['Producer', (ctx) => topThreeTracksSum(ctx) >= 16],
  ['Researcher', (ctx) => ctx.trackPos(3) >= 4],
  ['Spacefarer4', (ctx) => ctx.trackPos(1) >= 4],
  ['Sponsor', (ctx) => ctx.playedCards.costing20Plus >= 3],
  ['Tactician4', (ctx) => ctx.mc >= 30],
  ['Terraformer29', () => false],
  ['Terran5', (ctx) => ctx.trackPos(5) >= 5],
  ['Thawer', (ctx) => ctx.temperatureRaises >= 5],
  ['Trader', () => false],
  ['Tycoon10', (ctx) => ctx.playedCards.greenOrBlue >= 10],
]);

/**
 * Award evaluation functions for MarsBot.
 * Returns the numeric score, or undefined for fallback to default game evaluation.
 */
export const AWARD_EVALS: Map<AwardName, (ctx: MarsBotMAContext) => number | undefined> = new Map([
  // Tharsis
  ['Landlord', (ctx) => ctx.tilesOwned],
  ['Banker', (ctx) => ctx.trackPos(0) + ctx.trackPos(2)],
  ['Scientist', (ctx) => ctx.trackPos(3)],
  ['Thermalist', (ctx) => ctx.trackPos(4) + 5],
  ['Miner', (ctx) => ctx.trackPos(1) + 5],
  // Hellas
  ['Cultivator', () => undefined],
  ['Magnate', (ctx) => ctx.playedCards.green],
  ['Space Baron', (ctx) => ctx.trackPos(1)],
  ['Excentric', (ctx) => Math.floor(ctx.mc / 5)],
  ['Contractor', (ctx) => ctx.trackPos(0)],
  // Elysium
  ['Celebrity', (ctx) => ctx.playedCards.costing20Plus],
  ['Industrialist', (ctx) => ctx.trackPos(4) + 5],
  ['Desert Settler', () => undefined],
  ['Estate Dealer', () => undefined],
  ['Benefactor', (ctx) => Math.max(0, ctx.tr - 15)],
  // Terra Cimmeria
  ['Electrician', (ctx) => ctx.trackPos(4)],
  ['Founder', () => undefined],
  ['Mogul', (ctx) => ctx.highestTrackPos * 2],
  ['Zoologist', (ctx) => ctx.trackPos(6) + 5],
  ['Forecaster', (ctx) => Math.floor(ctx.mc / 7)],
  // Utopia Planitia
  ['Suburbian', () => undefined],
  ['Investor', (ctx) => ctx.trackPos(0) + ctx.trackPos(3)],
  ['Botanist', (ctx) => Math.max(0, ctx.trackPos(6) - 2)],
  ['Incorporator', (ctx) => ctx.playedCards.costing10OrLess],
  ['Metropolist', () => undefined],
  // Vastitas Borealis Nova
  ['Traveller', (ctx) => ctx.trackPos(0) + ctx.trackPos(3) + 5],
  ['Landscaper', () => undefined],
  ['Highlander', () => undefined],
  ['Manufacturer', (ctx) => ctx.trackPos(0) + ctx.trackPos(4)],
  ['Blacksmith', (ctx) => Math.max(ctx.trackPos(0), ctx.trackPos(1))],
  // Modular
  ['Administrator', (ctx) => ctx.playedCards.withoutTags + 2],
  ['Collector', (ctx) => ctx.tracksAtOrAbove(3)],
  ['Constructor', () => undefined],
  ['Politician', () => 5],
  ['Visionary', (ctx) => ctx.lowestTrackPos * 2],
  ['Promoter', (ctx) => ctx.trackPos(4)],
]);
