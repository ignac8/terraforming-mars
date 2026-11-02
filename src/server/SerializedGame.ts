import {Phase} from '../common/Phase';
import {SerializedClaimedMilestone} from './milestones/ClaimedMilestone';
import {SerializedFundedAward} from './awards/FundedAward';
import {DeferredAction} from './deferredActions/DeferredAction';
import {SerializedColony} from './SerializedColony';
import {CubeType} from '../common/automa/AutomaTypes';
import {SerializedPlayer} from './SerializedPlayer';
import {SerializedTurmoil} from './turmoil/SerializedTurmoil';
import {PlayerId, GameId, SpectatorId, SpaceId} from '../common/Types';
import {GameOptions} from './game/GameOptions';
import {AresData} from '../common/ares/AresData';
import {LogMessage} from '../common/logs/LogMessage';
import {SerializedBoard} from './boards/SerializedBoard';
import {SerializedMoonData} from './moon/SerializedMoonData';
import {SerializedPathfindersData} from './pathfinders/SerializedPathfindersData';
import {SerializedDeck} from './cards/SerializedDeck';
import {UnderworldData} from './underworld/UnderworldData';
import {AwardName} from '../common/ma/AwardName';
import {GlobalParameter} from '../common/GlobalParameter';
import {MilestoneName} from '../common/ma/MilestoneName';
import {Tag} from '../common/cards/Tag';
import {RewindRecord} from './rewind/RewindRecord';
import {RecordedInput} from './rewind/RecordedInput';
import {RewindRequestLimits, SerializedRewindVote} from './rewind/tableState';

export type SerializedGame = {
    activePlayer: PlayerId;
    aresData?: AresData;
    awards: Array<AwardName>;
    beholdTheEmperor?: boolean;
    board: SerializedBoard;
    ceoDeck: SerializedDeck;
    currentSeed: number;
    claimedMilestones: Array<SerializedClaimedMilestone>;
    clonedGamedId?: string;
    colonies: Array<SerializedColony>;
    corporationDeck: SerializedDeck,
    createdTimeMs: number;
    deferredActions: Array<DeferredAction>;
    donePlayers: Array<PlayerId>;
    draftRound: number;
    exploitationOfVenusInEffect: boolean;
    first: PlayerId;
    /** Written only when true. */
    frozen?: boolean;
    fundedAwards: Array<SerializedFundedAward>;
    gagarinBase: Array<SpaceId>;
    gameAge: number;
    gameLog: Array<LogMessage>;
    gameOptions: GameOptions;
    generation: number;
    globalsPerGeneration: Array<Partial<Record<GlobalParameter, number>>>;
    id: GameId;
    initialDraftIteration: number;
    /** The inputs processed since the previous save. Missing in games saved before they were recorded. */
    inputs?: Array<RecordedInput>;
    lastSaveId: number;
    milestones: Array<MilestoneName>;
    moonData: SerializedMoonData | undefined;
    name: string;
    nomadSpace: SpaceId | undefined;
    pathfindersData: SerializedPathfindersData | undefined;
    oxygenLevel: number;
    passedPlayers: Array<PlayerId>;
    phase: Phase;
    players: Array<SerializedPlayer>;
    preludeDeck: SerializedDeck,
    projectDeck: SerializedDeck,
    researchedPlayers: Array<PlayerId>;
    rewinds?: Array<RewindRecord>;
    /** Written only when set. */
    rewindVote?: SerializedRewindVote;
    /** Written only for the game's current generation. */
    rewindRequestLimits?: RewindRequestLimits;
    seed: number;
    someoneHasRemovedOtherPlayersPlants: boolean;
    spectatorId: SpectatorId;
    stJosephCathedrals: Array<SpaceId>;
    syndicatePirateRaider: PlayerId | undefined;
    tags: ReadonlyArray<Tag>
    temperature: number;
    tradeEmbargo?: boolean;
    turmoil?: SerializedTurmoil;
    undoCount: number;
    underworldData: UnderworldData;
    venusScaleLevel: number;
    verminInEffect: boolean;

    // Automa
    automaState?: SerializedAutomaState;
}

export type SerializedAutomaState = {
    trackPositions: Array<number>;
    trackRegressedPositions: Array<Array<number>>;
    megacredits: number;
    goesFirst: boolean;
    difficulty: 'easy' | 'normal' | 'hard' | 'brutal';
    actionDeckCardNames: Array<string>;
    bonusDeck: SerializedDeck;
    neuralInstanceSpaceId: string | undefined;
    playedProjectCardNames: Array<string>;
    /** The last generation whose Hard mode first-turn milestone check has run; older saves lack it. */
    firstTurnCheckedGeneration?: number;
    /** Whether the corp's before-action-phase box waits for the player's preludes; older saves lack it. */
    beforeActionPhasePending?: boolean;
    marsBotPlayerId: string;
    // Corporation framework
    corpId?: string;
    trackCubePositions?: Array<{trackIndex: number, position: number, cubeType: CubeType}>;
    triggeredCubePositions?: Array<string>;
    corpSpecificState?: Record<string, unknown>;
    floaters?: number;
    vpByGeneration?: Array<number>;
    /** The bot player's terraform rating; older saves lack it and keep the starting value. */
    terraformRating?: number;
    /** The bot player's global parameter steps; older saves lack them and keep zeros. */
    globalParameterSteps?: Partial<Record<GlobalParameter, number>>;
    temperatureRaises?: number;
    destroyedBonusCards?: number;
    colonyCubePositions?: Array<string>;
    hasSecondTradeFleet?: boolean;
    /** The "trackIndex:position" of the 2nd Trade Fleet cube; older saves lack it and have it on Event 9 or Energy 9. */
    tradeFleetCubeKey?: string;
    shippingBoard?: Record<string, number>;
    /** Spaces holding one of the bot's player markers (Settlers) and no tile yet. */
    markerSpaceIds?: Array<SpaceId>;

    // Older saved games hold megacredits and floaters under these names.
    mcSupply?: number;
    floaterCount?: number;
    // Older saved games hold the bonus deck as these two piles, bonus cards by id and project cards by name.
    bonusDeckDrawPile?: Array<string>;
    bonusDeckDiscardPile?: Array<string>;
}
