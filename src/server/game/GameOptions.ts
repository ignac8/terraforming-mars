import * as constants from '../../common/constants';
import {BoardName} from '../../common/boards/BoardName';
import {CardName} from '../../common/cards/CardName';
import {ColonyName} from '../../common/colonies/ColonyName';
import {GameId} from '../../common/Types';
import {RandomMAOptionType} from '../../common/ma/RandomMAOptionType';
import {AgendaStyle} from '../../common/turmoil/Types';
import {Expansion} from '../../common/cards/GameModule';
import {EscapeVelocityOptions} from '../../common/game/NewGameConfig';

export type GameOptions = {
  boardName: BoardName;
  clonedGamedId: GameId | undefined;

  // Configuration
  undoOption: boolean;
  showTimers: boolean;
  fastModeOption: boolean;
  showOtherPlayersVP: boolean;

  // Extensions -- Deprecated, except when importing JSON
  corporateEra: boolean;
  venusNextExtension: boolean;
  coloniesExtension: boolean;
  preludeExtension: boolean;
  prelude2Expansion: boolean;
  turmoilExtension: boolean;
  promoCardsOption: boolean;
  communityCardsOption: boolean;
  aresExtension: boolean;
  aresHazards: boolean;
  aresExtremeVariant: boolean;
  politicalAgendasExtension: AgendaStyle;
  solarPhaseOption: boolean;
  removeNegativeGlobalEventsOption: boolean;
  moonExpansion: boolean;
  pathfindersExpansion: boolean;
  ceoExtension: boolean;
  starWarsExpansion: boolean;
  underworldExpansion: boolean;
  deltaProjectExpansion: boolean;
  tournamentExpansion: boolean;

  expansions: Record<Expansion, boolean>,

  // Variants
  draftVariant: boolean;
  initialDraftVariant: boolean;
  preludeDraftVariant: boolean;
  ceosDraftVariant: boolean;
  // corporationsDraft: boolean;
  startingCorporations: number;
  shuffleMapOption: boolean;
  randomMA: RandomMAOptionType;
  includeFanMA: boolean;
  modularMA: boolean;
  /** Solo victory by getting TR 63 by game end */
  soloTR: boolean;
  customCorporationsList: ReadonlyArray<CardName>;
  bannedCards: ReadonlyArray<CardName>;
  includedCards: ReadonlyArray<CardName>;
  customColoniesList: ReadonlyArray<ColonyName>;
  customPreludes: ReadonlyArray<CardName>;
  customCeos: ReadonlyArray<CardName>;
  startingCeos: number;
  startingPreludes: number;
  /** Moon must be completed to end the game */
  requiresMoonTrackCompletion: boolean;
  /** Venus must be completed to end the game */
  requiresVenusTrackCompletion: boolean;
  /** Standard projects cost more MC and do not require steel or titanium */
  moonStandardProjectVariant: boolean;
  /** Standard projects can be paid for with steel or titanium at a 1MC loss per alloy */
  moonStandardProjectVariant1: boolean;
  altVenusBoard: boolean;
  escapeVelocity?: EscapeVelocityOptions;
  twoCorpsVariant: boolean;
}

/**
 * Forces the game options the tournament regulations prescribe. The create
 * game form locks the same options, but the client is not trusted.
 *
 * Base + Corporate Era only, draft everywhere, an official board, and none
 * of the rule-changing variants. Player count, timers, undo and the
 * corporation pool override stay untouched.
 */
export function applyTournamentPreset(options: GameOptions): void {
  options.corporateEra = true;
  options.preludeExtension = false;
  options.prelude2Expansion = false;
  options.venusNextExtension = false;
  options.coloniesExtension = false;
  options.turmoilExtension = false;
  options.promoCardsOption = false;
  options.communityCardsOption = false;
  options.aresExtension = false;
  options.aresExtremeVariant = false;
  options.moonExpansion = false;
  options.pathfindersExpansion = false;
  options.ceoExtension = false;
  options.starWarsExpansion = false;
  options.underworldExpansion = false;
  options.deltaProjectExpansion = false;
  options.expansions = {
    ...options.expansions,
    corpera: true,
    prelude: false,
    prelude2: false,
    venus: false,
    colonies: false,
    turmoil: false,
    promo: false,
    community: false,
    ares: false,
    moon: false,
    pathfinders: false,
    ceo: false,
    starwars: false,
    underworld: false,
    deltaProject: false,
    tournament: true,
  };
  options.draftVariant = true;
  options.initialDraftVariant = true;
  options.preludeDraftVariant = false;
  options.ceosDraftVariant = false;
  options.solarPhaseOption = false;
  options.politicalAgendasExtension = 'Standard';
  options.randomMA = RandomMAOptionType.NONE;
  options.includeFanMA = false;
  options.modularMA = false;
  options.shuffleMapOption = false;
  options.escapeVelocity = undefined;
  options.altVenusBoard = false;
  options.requiresMoonTrackCompletion = false;
  options.requiresVenusTrackCompletion = false;
  options.moonStandardProjectVariant = false;
  options.moonStandardProjectVariant1 = false;
  options.twoCorpsVariant = false;
  const officialBoards = [BoardName.THARSIS, BoardName.HELLAS, BoardName.ELYSIUM];
  if (!officialBoards.includes(options.boardName)) {
    options.boardName = BoardName.THARSIS;
  }
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  altVenusBoard: false,
  aresExtension: false,
  aresHazards: true,
  aresExtremeVariant: false,
  boardName: BoardName.THARSIS,
  bannedCards: [],
  includedCards: [],
  ceoExtension: false,
  clonedGamedId: undefined,
  coloniesExtension: false,
  communityCardsOption: false,
  corporateEra: true,
  customCeos: [],
  customColoniesList: [],
  customCorporationsList: [],
  customPreludes: [],
  draftVariant: false,
  escapeVelocity: undefined,
  expansions: {
    corpera: false,
    promo: false,
    venus: false,
    colonies: false,
    prelude: false,
    prelude2: false,
    turmoil: false,
    community: false,
    ares: false,
    moon: false,
    pathfinders: false,
    ceo: false,
    starwars: false,
    underworld: false,
    deltaProject: false,
    tournament: false,
  },
  fastModeOption: false,
  includeFanMA: false,
  initialDraftVariant: false,
  modularMA: false,
  moonExpansion: false,
  moonStandardProjectVariant: false,
  moonStandardProjectVariant1: false,
  pathfindersExpansion: false,
  politicalAgendasExtension: 'Standard',
  preludeDraftVariant: false,
  ceosDraftVariant: false,
  preludeExtension: false,
  prelude2Expansion: false,
  promoCardsOption: false,
  randomMA: RandomMAOptionType.NONE,
  requiresMoonTrackCompletion: false,
  removeNegativeGlobalEventsOption: false,
  requiresVenusTrackCompletion: false,
  showOtherPlayersVP: false,
  showTimers: true,
  shuffleMapOption: false,
  solarPhaseOption: false,
  soloTR: false,
  startingCeos: constants.CEO_CARDS_DEALT_PER_PLAYER,
  startingCorporations: constants.CORPORATION_CARDS_DEALT_PER_PLAYER,
  startingPreludes: constants.PRELUDE_CARDS_DEALT_PER_PLAYER,
  starWarsExpansion: false,
  turmoilExtension: false,
  underworldExpansion: false,
  deltaProjectExpansion: false,
  tournamentExpansion: false,
  undoOption: false,
  venusNextExtension: false,
  twoCorpsVariant: false,
};
