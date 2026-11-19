import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCardEffect} from './MarsBotBonusCardEffect';
import {MeteorShowerMarsBot} from './MeteorShowerMarsBot';
import {InvasiveSpeciesMarsBot} from './InvasiveSpeciesMarsBot';
import {ResearchAndDevelopmentMarsBot} from './ResearchAndDevelopmentMarsBot';
import {OverachievementMarsBot} from './OverachievementMarsBot';
import {ExpeditedConstructionMarsBot} from './ExpeditedConstructionMarsBot';
import {LobbyistsMarsBot} from './LobbyistsMarsBot';
import {LobbyistsVenusMarsBot} from './LobbyistsVenusMarsBot';
import {GovernmentInterventionMarsBot} from './GovernmentInterventionMarsBot';
import {LocalNeuralInstanceMarsBot} from './LocalNeuralInstanceMarsBot';
import {CorporateCompetitionMarsBot} from './CorporateCompetitionMarsBot';
import {ExpeditedConstructionColoniesMarsBot} from './ExpeditedConstructionColoniesMarsBot';
import {OuterSystemFootholdMarsBot} from './OuterSystemFootholdMarsBot';
import {ShippingLinesMarsBot} from './ShippingLinesMarsBot';
import {ExtendedShippingLinesMarsBot} from './ExtendedShippingLinesMarsBot';
import {PartyPoliticsMarsBot} from './PartyPoliticsMarsBot';
import {SettlersMarsBot} from './SettlersMarsBot';
import {RapidSproutingMarsBot} from './RapidSproutingMarsBot';
import {SupplyAndDemandMarsBot} from './SupplyAndDemandMarsBot';
import {DoItRightMarsBot} from './DoItRightMarsBot';
import {VenusianLobbyMarsBot} from './VenusianLobbyMarsBot';
import {BuildBuildBuildMarsBot} from './BuildBuildBuildMarsBot';
import {DiversificationMarsBot} from './DiversificationMarsBot';
import {GrayEminenceMarsBot} from './GrayEminenceMarsBot';
import {InterfaceHyperlinkMarsBot} from './InterfaceHyperlinkMarsBot';
import {GovernmentSubsidyMarsBot} from './GovernmentSubsidyMarsBot';
import {InvestorsMarsBot} from './InvestorsMarsBot';

/**
 * The effect of each bonus card. An id without one does nothing when it is resolved.
 *
 * The effects keep no state, so these instances serve every game.
 */
export const MARSBOT_BONUS_CARD_EFFECTS: Partial<Record<BonusCardId, MarsBotBonusCardEffect>> = {
  [BonusCardId.B01_METEOR_SHOWER]: new MeteorShowerMarsBot(),
  [BonusCardId.B02_INVASIVE_SPECIES]: new InvasiveSpeciesMarsBot(),
  [BonusCardId.B03_RESEARCH_AND_DEVELOPMENT]: new ResearchAndDevelopmentMarsBot(),
  [BonusCardId.B04_OVERACHIEVEMENT]: new OverachievementMarsBot(),
  [BonusCardId.B05_EXPEDITED_CONSTRUCTION]: new ExpeditedConstructionMarsBot(),
  [BonusCardId.B06_LOBBYISTS]: new LobbyistsMarsBot(),
  [BonusCardId.B15_LOBBYISTS_VENUS]: new LobbyistsVenusMarsBot(),
  [BonusCardId.B16_GOVERNMENT_INTERVENTION]: new GovernmentInterventionMarsBot(),
  [BonusCardId.B07_LOCAL_NEURAL_INSTANCE]: new LocalNeuralInstanceMarsBot(),
  [BonusCardId.B08_CORPORATE_COMPETITION]: new CorporateCompetitionMarsBot(),
  // Colonies bonus cards (B17-B20)
  [BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES]: new ExpeditedConstructionColoniesMarsBot(),
  [BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD]: new OuterSystemFootholdMarsBot(),
  [BonusCardId.B19_SHIPPING_LINES]: new ShippingLinesMarsBot(),
  [BonusCardId.B20_EXTENDED_SHIPPING_LINES]: new ExtendedShippingLinesMarsBot(),
  // Turmoil bonus card
  [BonusCardId.B21_PARTY_POLITICS]: new PartyPoliticsMarsBot(),
  // Corp-specific bonus cards (B22-B32)
  [BonusCardId.B22_SETTLERS]: new SettlersMarsBot(),
  [BonusCardId.B23_RAPID_SPROUTING]: new RapidSproutingMarsBot(),
  [BonusCardId.B24_SUPPLY_AND_DEMAND]: new SupplyAndDemandMarsBot(),
  [BonusCardId.B25_DO_IT_RIGHT]: new DoItRightMarsBot(),
  [BonusCardId.B26_VENUSIAN_LOBBY]: new VenusianLobbyMarsBot(),
  [BonusCardId.B27_BUILD_BUILD_BUILD]: new BuildBuildBuildMarsBot(),
  [BonusCardId.B28_DIVERSIFICATION]: new DiversificationMarsBot(),
  [BonusCardId.B29_GRAY_EMINENCE]: new GrayEminenceMarsBot(),
  [BonusCardId.B30_INTERFACE_HYPERLINK]: new InterfaceHyperlinkMarsBot(),
  [BonusCardId.B31_GOVERNMENT_SUBSIDY]: new GovernmentSubsidyMarsBot(),
  [BonusCardId.B32_INVESTORS]: new InvestorsMarsBot(),
};
