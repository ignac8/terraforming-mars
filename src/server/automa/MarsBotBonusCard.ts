import {BonusCardId} from '../../common/automa/AutomaTypes';

export interface MarsBotBonusCard {
  readonly id: BonusCardId;
  readonly name: string;
  /** If true, this card has been destroyed and cannot re-enter the game. */
  destroyed: boolean;
}

export function bonusCard(id: BonusCardId, name: string): MarsBotBonusCard {
  return {id, name, destroyed: false};
}

/** Create the base set of bonus cards (B01–B08). */
export function createBaseBonusCards(): Array<MarsBotBonusCard> {
  return [
    bonusCard(BonusCardId.B01_METEOR_SHOWER, 'Meteor Shower'),
    bonusCard(BonusCardId.B02_INVASIVE_SPECIES, 'Invasive Species'),
    bonusCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT, 'Research and Development'),
    bonusCard(BonusCardId.B04_OVERACHIEVEMENT, 'Overachievement'),
    bonusCard(BonusCardId.B05_EXPEDITED_CONSTRUCTION, 'Expedited Construction'),
    bonusCard(BonusCardId.B06_LOBBYISTS, 'Lobbyists'),
    bonusCard(BonusCardId.B07_LOCAL_NEURAL_INSTANCE, 'Local Neural Instance'),
    bonusCard(BonusCardId.B08_CORPORATE_COMPETITION, 'Corporate Competition'),
  ];
}

/** Create a single corp-specific bonus card by ID. */
export function createCorpBonusCard(id: BonusCardId): MarsBotBonusCard {
  return bonusCard(id, CORP_BONUS_CARD_NAMES.get(id) ?? id);
}

const CORP_BONUS_CARD_NAMES: Map<BonusCardId, string> = new Map([
  [BonusCardId.B15_LOBBYISTS_VENUS, 'Lobbyists (Venus)'],
  [BonusCardId.B16_GOVERNMENT_INTERVENTION, 'Government Intervention'],
  [BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES, 'Expedited Construction (Colonies)'],
  [BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD, 'Outer System Foothold'],
  [BonusCardId.B19_SHIPPING_LINES, 'Shipping Lines'],
  [BonusCardId.B20_EXTENDED_SHIPPING_LINES, 'Extended Shipping Lines'],
  [BonusCardId.B21_PARTY_POLITICS, 'Party Politics'],
  [BonusCardId.B22_SETTLERS, 'Settlers'],
  [BonusCardId.B23_RAPID_SPROUTING, 'Rapid Sprouting'],
  [BonusCardId.B24_SUPPLY_AND_DEMAND, 'Supply & Demand'],
  [BonusCardId.B25_DO_IT_RIGHT, 'Do It Right'],
  [BonusCardId.B26_VENUSIAN_LOBBY, 'Venusian Lobby'],
  [BonusCardId.B27_BUILD_BUILD_BUILD, 'Build, Build, Build'],
  [BonusCardId.B28_DIVERSIFICATION, 'Diversification'],
  [BonusCardId.B29_GRAY_EMINENCE, 'Gray Eminence'],
  [BonusCardId.B30_INTERFACE_HYPERLINK, 'Interface Hyperlink'],
  [BonusCardId.B31_GOVERNMENT_SUBSIDY, 'Government Subsidy'],
  [BonusCardId.B32_INVESTORS, 'Investors'],
]);
