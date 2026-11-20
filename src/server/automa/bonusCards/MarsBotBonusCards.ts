import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {newProjectCard} from '@/server/createCard';
import {BuildBuildBuildMarsBot} from '@/server/automa/bonusCards/BuildBuildBuildMarsBot';
import {CorporateCompetitionMarsBot} from '@/server/automa/bonusCards/CorporateCompetitionMarsBot';
import {DiversificationMarsBot} from '@/server/automa/bonusCards/DiversificationMarsBot';
import {DoItRightMarsBot} from '@/server/automa/bonusCards/DoItRightMarsBot';
import {ExpeditedConstructionColoniesMarsBot} from '@/server/automa/bonusCards/ExpeditedConstructionColoniesMarsBot';
import {ExpeditedConstructionMarsBot} from '@/server/automa/bonusCards/ExpeditedConstructionMarsBot';
import {ExtendedShippingLinesMarsBot} from '@/server/automa/bonusCards/ExtendedShippingLinesMarsBot';
import {GovernmentInterventionMarsBot} from '@/server/automa/bonusCards/GovernmentInterventionMarsBot';
import {GovernmentSubsidyMarsBot} from '@/server/automa/bonusCards/GovernmentSubsidyMarsBot';
import {GrayEminenceMarsBot} from '@/server/automa/bonusCards/GrayEminenceMarsBot';
import {InterfaceHyperlinkMarsBot} from '@/server/automa/bonusCards/InterfaceHyperlinkMarsBot';
import {InvasiveSpeciesMarsBot} from '@/server/automa/bonusCards/InvasiveSpeciesMarsBot';
import {InvestorsMarsBot} from '@/server/automa/bonusCards/InvestorsMarsBot';
import {LobbyistsMarsBot} from '@/server/automa/bonusCards/LobbyistsMarsBot';
import {LobbyistsVenusMarsBot} from '@/server/automa/bonusCards/LobbyistsVenusMarsBot';
import {LocalNeuralInstanceMarsBot} from '@/server/automa/bonusCards/LocalNeuralInstanceMarsBot';
import {MeteorShowerMarsBot} from '@/server/automa/bonusCards/MeteorShowerMarsBot';
import {OuterSystemFootholdMarsBot} from '@/server/automa/bonusCards/OuterSystemFootholdMarsBot';
import {OverachievementMarsBot} from '@/server/automa/bonusCards/OverachievementMarsBot';
import {PartyPoliticsMarsBot} from '@/server/automa/bonusCards/PartyPoliticsMarsBot';
import {RapidSproutingMarsBot} from '@/server/automa/bonusCards/RapidSproutingMarsBot';
import {ResearchAndDevelopmentMarsBot} from '@/server/automa/bonusCards/ResearchAndDevelopmentMarsBot';
import {SettlersMarsBot} from '@/server/automa/bonusCards/SettlersMarsBot';
import {ShippingLinesMarsBot} from '@/server/automa/bonusCards/ShippingLinesMarsBot';
import {SupplyAndDemandMarsBot} from '@/server/automa/bonusCards/SupplyAndDemandMarsBot';
import {VenusianLobbyMarsBot} from '@/server/automa/bonusCards/VenusianLobbyMarsBot';

/** The bonus cards that have a class of their own. */
const BONUS_CARDS = new Map<BonusCardId, () => MarsBotBonusCard>([
  [BonusCardId.B01_METEOR_SHOWER, () => new MeteorShowerMarsBot()],
  [BonusCardId.B02_INVASIVE_SPECIES, () => new InvasiveSpeciesMarsBot()],
  [BonusCardId.B03_RESEARCH_AND_DEVELOPMENT, () => new ResearchAndDevelopmentMarsBot()],
  [BonusCardId.B04_OVERACHIEVEMENT, () => new OverachievementMarsBot()],
  [BonusCardId.B05_EXPEDITED_CONSTRUCTION, () => new ExpeditedConstructionMarsBot()],
  [BonusCardId.B06_LOBBYISTS, () => new LobbyistsMarsBot()],
  [BonusCardId.B07_LOCAL_NEURAL_INSTANCE, () => new LocalNeuralInstanceMarsBot()],
  [BonusCardId.B08_CORPORATE_COMPETITION, () => new CorporateCompetitionMarsBot()],
  [BonusCardId.B15_LOBBYISTS_VENUS, () => new LobbyistsVenusMarsBot()],
  [BonusCardId.B16_GOVERNMENT_INTERVENTION, () => new GovernmentInterventionMarsBot()],
  [BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES, () => new ExpeditedConstructionColoniesMarsBot()],
  [BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD, () => new OuterSystemFootholdMarsBot()],
  [BonusCardId.B19_SHIPPING_LINES, () => new ShippingLinesMarsBot()],
  [BonusCardId.B20_EXTENDED_SHIPPING_LINES, () => new ExtendedShippingLinesMarsBot()],
  [BonusCardId.B21_PARTY_POLITICS, () => new PartyPoliticsMarsBot()],
  [BonusCardId.B22_SETTLERS, () => new SettlersMarsBot()],
  [BonusCardId.B23_RAPID_SPROUTING, () => new RapidSproutingMarsBot()],
  [BonusCardId.B24_SUPPLY_AND_DEMAND, () => new SupplyAndDemandMarsBot()],
  [BonusCardId.B25_DO_IT_RIGHT, () => new DoItRightMarsBot()],
  [BonusCardId.B26_VENUSIAN_LOBBY, () => new VenusianLobbyMarsBot()],
  [BonusCardId.B27_BUILD_BUILD_BUILD, () => new BuildBuildBuildMarsBot()],
  [BonusCardId.B28_DIVERSIFICATION, () => new DiversificationMarsBot()],
  [BonusCardId.B29_GRAY_EMINENCE, () => new GrayEminenceMarsBot()],
  [BonusCardId.B30_INTERFACE_HYPERLINK, () => new InterfaceHyperlinkMarsBot()],
  [BonusCardId.B31_GOVERNMENT_SUBSIDY, () => new GovernmentSubsidyMarsBot()],
  [BonusCardId.B32_INVESTORS, () => new InvestorsMarsBot()],
]);

/**
 * Creates a bonus card by id, from any set.
 *
 * An id without a class of its own gives a blank card, which does nothing when it resolves.
 */
export function createBonusCard(id: BonusCardId): MarsBotBonusCard {
  return BONUS_CARDS.get(id)?.() ?? new MarsBotBonusCard({id, name: id as unknown as CardName});
}

/** Create the base set of bonus cards (B01-B08). */
export function createBaseBonusCards(): Array<MarsBotBonusCard> {
  return [
    BonusCardId.B01_METEOR_SHOWER,
    BonusCardId.B02_INVASIVE_SPECIES,
    BonusCardId.B03_RESEARCH_AND_DEVELOPMENT,
    BonusCardId.B04_OVERACHIEVEMENT,
    BonusCardId.B05_EXPEDITED_CONSTRUCTION,
    BonusCardId.B06_LOBBYISTS,
    BonusCardId.B07_LOCAL_NEURAL_INSTANCE,
    BonusCardId.B08_CORPORATE_COMPETITION,
  ].map(createBonusCard);
}

/**
 * A card in MarsBot's bonus deck: a bonus card, or a project card a corporation put there.
 *
 * Only bonus cards have an `id`. MarsBot plays a project card drawn from the bonus deck like one
 * from its action deck.
 */
export type MarsBotBonusDeckCard = MarsBotBonusCard | (IProjectCard & {readonly id?: undefined});

/** Card name without its ':automa' suffix, for log lines that print the name raw. */
export function bonusCardDisplayName(card: MarsBotBonusDeckCard): string {
  return card.name.split(':')[0];
}

/** Restore bonus deck cards from their serialized names: bonus cards, and project cards a corporation put there. */
export function marsBotBonusCardsFromJSON(names: ReadonlyArray<CardName>): Array<MarsBotBonusDeckCard> {
  const byName = new Map<CardName, BonusCardId>();
  for (const id of BONUS_CARDS.keys()) {
    byName.set(createBonusCard(id).name, id);
  }
  const cards: Array<MarsBotBonusDeckCard> = [];
  for (const name of names) {
    const id = byName.get(name);
    const card = id !== undefined ? createBonusCard(id) : newProjectCard(name);
    if (card === undefined) {
      throw new Error(`Cannot restore MarsBot bonus deck card ${name}`);
    }
    cards.push(card);
  }
  return cards;
}
