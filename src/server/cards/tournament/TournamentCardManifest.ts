import {CardName} from '../../../common/cards/CardName';
import {ModuleManifest} from '../ModuleManifest';
import {CheungShingMARSTournament} from './CheungShingMARSTournament';
import {CrediCorTournament} from './CrediCorTournament';
import {EcoLineTournament} from './EcoLineTournament';
import {EcotecTournament} from './EcotecTournament';
import {FactorumTournament} from './FactorumTournament';
import {InterplanetaryCinematicsTournament} from './InterplanetaryCinematicsTournament';
import {InventrixTournament} from './InventrixTournament';
import {ManutechTournament} from './ManutechTournament';
import {NirgalEnterprisesTournament} from './NirgalEnterprisesTournament';
import {PalladinShippingTournament} from './PalladinShippingTournament';
import {PhoboLogTournament} from './PhoboLogTournament';
import {RecyclonTournament} from './RecyclonTournament';
import {SagittaFrontierServicesTournament} from './SagittaFrontierServicesTournament';
import {TeractorTournament} from './TeractorTournament';
import {UnitedNationsMarsInitiativeTournament} from './UnitedNationsMarsInitiativeTournament';
import {UtopiaInvestTournament} from './UtopiaInvestTournament';

export const TOURNAMENT_CARD_MANIFEST = new ModuleManifest({
  module: 'tournament',
  corporationCards: {
    [CardName.INVENTRIX_TOURNAMENT]: {Factory: InventrixTournament},
    [CardName.SAGITTA_FRONTIER_SERVICES_TOURNAMENT]: {Factory: SagittaFrontierServicesTournament},
    [CardName.PHOBOLOG_TOURNAMENT]: {Factory: PhoboLogTournament},
    [CardName.CREDICOR_TOURNAMENT]: {Factory: CrediCorTournament},
    [CardName.TERACTOR_TOURNAMENT]: {Factory: TeractorTournament},
    [CardName.FACTORUM_TOURNAMENT]: {Factory: FactorumTournament},
    [CardName.ECOLINE_TOURNAMENT]: {Factory: EcoLineTournament},
    [CardName.NIRGAL_ENTERPRISES_TOURNAMENT]: {Factory: NirgalEnterprisesTournament},
    [CardName.RECYCLON_TOURNAMENT]: {Factory: RecyclonTournament},
    [CardName.INTERPLANETARY_CINEMATICS_TOURNAMENT]: {Factory: InterplanetaryCinematicsTournament},
    [CardName.MANUTECH_TOURNAMENT]: {Factory: ManutechTournament},
    [CardName.CHEUNG_SHING_MARS_TOURNAMENT]: {Factory: CheungShingMARSTournament},
    [CardName.PALLADIN_SHIPPING_TOURNAMENT]: {Factory: PalladinShippingTournament},
    [CardName.ECOTEC_TOURNAMENT]: {Factory: EcotecTournament},
    [CardName.UNITED_NATIONS_MARS_INITIATIVE_TOURNAMENT]: {Factory: UnitedNationsMarsInitiativeTournament},
    [CardName.UTOPIA_INVEST_TOURNAMENT]: {Factory: UtopiaInvestTournament},
  },
});
