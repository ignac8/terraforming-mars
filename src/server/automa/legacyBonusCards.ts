import {BonusCardName} from '@/common/automa/BonusCardName';
import {isBonusCardName} from '@/server/automa/bonusCards/MarsBotBonusCards';

/**
 * The id each bonus card had in saves made before BonusCardName.
 *
 * Those saves hold bonus cards by this id, or by their name with an ':automa' suffix. Recorded replay
 * hashes hold the id, so stateHash still compares bonus cards by it.
 */
export const LEGACY_BONUS_CARD_IDS: Record<BonusCardName, string> = {
  [BonusCardName.METEOR_SHOWER]: 'B01',
  [BonusCardName.INVASIVE_SPECIES]: 'B02',
  [BonusCardName.RESEARCH_AND_DEVELOPMENT]: 'B03',
  [BonusCardName.OVERACHIEVEMENT]: 'B04',
  [BonusCardName.EXPEDITED_CONSTRUCTION]: 'B05',
  [BonusCardName.LOBBYISTS]: 'B06',
  [BonusCardName.LOCAL_NEURAL_INSTANCE]: 'B07',
  [BonusCardName.CORPORATE_COMPETITION]: 'B08',
  [BonusCardName.CORPORATE_COMPETITION_HELLAS]: 'B09',
  [BonusCardName.CORPORATE_COMPETITION_ELYSIUM]: 'B10',
  [BonusCardName.CORPORATE_COMPETITION_UTOPIA]: 'B11',
  [BonusCardName.CORPORATE_COMPETITION_CIMMERIA]: 'B12',
  [BonusCardName.CORPORATE_COMPETITION_BOREALIS]: 'B13',
  [BonusCardName.CORPORATE_COMPETITION_MA]: 'B14',
  [BonusCardName.LOBBYISTS_VENUS]: 'B15',
  [BonusCardName.GOVERNMENT_INTERVENTION]: 'B16',
  [BonusCardName.EXPEDITED_CONSTRUCTION_COLONIES]: 'B17',
  [BonusCardName.OUTER_SYSTEM_FOOTHOLD]: 'B18',
  [BonusCardName.SHIPPING_LINES]: 'B19',
  [BonusCardName.EXTENDED_SHIPPING_LINES]: 'B20',
  [BonusCardName.PARTY_POLITICS]: 'B21',
  [BonusCardName.SETTLERS]: 'B22',
  [BonusCardName.RAPID_SPROUTING]: 'B23',
  [BonusCardName.SUPPLY_AND_DEMAND]: 'B24',
  [BonusCardName.DO_IT_RIGHT]: 'B25',
  [BonusCardName.VENUSIAN_LOBBY]: 'B26',
  [BonusCardName.BUILD_BUILD_BUILD]: 'B27',
  [BonusCardName.DIVERSIFICATION]: 'B28',
  [BonusCardName.GRAY_EMINENCE]: 'B29',
  [BonusCardName.INTERFACE_HYPERLINK]: 'B30',
  [BonusCardName.GOVERNMENT_SUBSIDY]: 'B31',
  [BonusCardName.INVESTORS]: 'B32',
};

const BY_LEGACY_ID = new Map(Object.values(BonusCardName).map((name) => [LEGACY_BONUS_CARD_IDS[name], name]));

const LEGACY_SUFFIX = ':automa';

/**
 * Reads a bonus card from a saved card entry, in any form a save has held it: its name, its legacy
 * id, or its name with the ':automa' suffix.
 *
 * Returns undefined for any other entry, such as a project card's name.
 */
export function bonusCardNameFromSave(entry: string): BonusCardName | undefined {
  if (isBonusCardName(entry)) {
    return entry;
  }
  const byId = BY_LEGACY_ID.get(entry);
  if (byId !== undefined) {
    return byId;
  }
  if (entry.endsWith(LEGACY_SUFFIX)) {
    const name = entry.slice(0, -LEGACY_SUFFIX.length);
    if (isBonusCardName(name)) {
      return name;
    }
  }
  return undefined;
}
