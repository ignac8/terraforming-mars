export const TEMPORARY_BONUS_TOKENS = [
  'mcprod1pertemp',
  'microbe2pertemp',
  'plant2pertemp',
  'steel2pertemp',
  'titanium1pertemp',
  'oceanrequirementmod',
  'oxygenrequirementmod',
  'temprequirementmod',
] as const;

export type TemporaryBonusToken = typeof TEMPORARY_BONUS_TOKENS[number];

const REGULAR_BONUS_TOKENS = [
  'nothing',
  'card1', 'card2',
  'corruption1', 'corruption2',
  'steel2plant', 'steel1production',
  'titanium2', 'titanium1production',
  'plant2', 'plant3', 'plant1production',
  'titaniumandplant',
  'energy2', 'energy1production', 'heat2production',
  'microbe2', 'tr', 'ocean',
  'sciencetag', 'planttag', 'place6mc',
  'anyresource1',
] as const;

export const UNDERGROUND_RESOURCE_TOKENS = [...REGULAR_BONUS_TOKENS, ...TEMPORARY_BONUS_TOKENS] as const;

/**
 * The different types of resources players may excavate using the Underworld expansion.
 *
 * These structure bonuses different from how space bonuses are laid out.
 * Space bonuses show an array of individual bonus items; this groups them as a single
 * token. This is just easier to work with and easier to render.
 */
export type UndergroundResourceToken = typeof UNDERGROUND_RESOURCE_TOKENS[number];

/**
 * Text descriptions of each Underground resource token.
 */
export const undergroundResourceTokenDescription: Record<UndergroundResourceToken, string> = {
  nothing: 'nothing',
  card1: 'draw 1 card',
  card2: 'draw 2 cards',
  corruption1: '1 corruption',
  corruption2: '2 corruption',
  steel1production: '1 steel production',
  titanium2: '2 titanium',
  titanium1production: '1 titanium production',
  plant2: '2 plants',
  plant3: '3 plants',
  plant1production: '1 plant production',
  titaniumandplant: '1 titanium and 1 plant',
  energy1production: '1 energy production',
  heat2production: '2 heat production',
  microbe2: '2 microbes',
  tr: '1 TR',
  ocean: 'place an ocean',
  plant2pertemp: '2 plants / 2 °C',
  steel2pertemp: '2 steel / 2 °C',
  titanium1pertemp: '1 titanium / 2 °C',
  microbe2pertemp: '2 microbes / 2 °C',
  steel2plant: '2 steel and 1 plant',
  energy2: '2 energy',
  mcprod1pertemp: '1 M€ production / 2 °C',
  sciencetag: '1 science tag',
  planttag: '1 plant tag',
  place6mc: 'Gain 6 M€ when placing a tile here',
  oceanrequirementmod: 'Ocean requirements are ±3',
  oxygenrequirementmod: 'Oxygen requirements are ±3',
  temprequirementmod: 'Temperature requirements are ±6 °C',
  anyresource1: 'Any resource except science',
};

/**
 * Markdown versions of the descriptions, with icon shortcodes in place of resource names,
 * for the game log. Keep `undergroundResourceTokenDescription` for plain text, which can't
 * render shortcodes.
 */
export const undergroundResourceTokenMarkdown: Record<UndergroundResourceToken, string> = {
  nothing: 'nothing',
  card1: 'draw 1 card',
  card2: 'draw 2 cards',
  corruption1: '1:r:corruption:',
  corruption2: '2:r:corruption:',
  steel1production: '1:p:steel:',
  titanium2: '2:r:titanium:',
  titanium1production: '1:p:titanium:',
  plant2: '2:r:plants:',
  plant3: '3:r:plants:',
  plant1production: '1:p:plants:',
  titaniumandplant: '1:r:titanium: and 1:r:plants:',
  energy1production: '1:p:energy:',
  heat2production: '2:p:heat:',
  microbe2: '2:cr:microbe:',
  tr: '1:icon:tr:',
  ocean: 'place an ocean',
  plant2pertemp: '2:r:plants: / 2 °C',
  steel2pertemp: '2:r:steel: / 2 °C',
  titanium1pertemp: '1:r:titanium: / 2 °C',
  microbe2pertemp: '2:cr:microbe: / 2 °C',
  steel2plant: '2:r:steel: and 1:r:plants:',
  energy2: '2:r:energy:',
  mcprod1pertemp: '1:p:megacredits: / 2 °C',
  sciencetag: '1:tag:science:',
  planttag: '1:tag:plant:',
  place6mc: 'Gain 6:r:megacredits: when placing a tile here',
  oceanrequirementmod: 'Ocean requirements are ±3',
  oxygenrequirementmod: 'Oxygen requirements are ±3',
  temprequirementmod: 'Temperature requirements are ±6 °C',
  anyresource1: 'Any resource except science',
};
