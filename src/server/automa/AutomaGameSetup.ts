import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Player} from '../Player';
import {GameOptions} from '../game/GameOptions';
import {GameId, isPlayerId, safeCast} from '../../common/Types';
import {Random} from '../../common/utils/Random';
import {MarsBot} from './MarsBot';
import {THARSIS_MARSBOT_BOARD, THARSIS_MARSBOT_BOARD_WITH_VENUS} from './boards/TharsisMarsBot';
import {TrackDefinition, MARSBOT_STARTING_TR} from '../../common/automa/AutomaTypes';
import {BoardName} from '../../common/boards/BoardName';
import {AutomaGameHooks} from './AutomaGameHooks';
import {MarsBotTags} from './MarsBotTags';
import {MarsBotStock, MarsBotProduction} from './MarsBotStock';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {ICard} from '../cards/ICard';
import {IMilestone} from '../milestones/IMilestone';
import {IAward} from '../awards/IAward';
import {trackCubeKey} from './MarsBotCorpTypes';
import {DELEGATES_PER_PLAYER} from '../../common/constants';

/**
 * Handles automa-specific game setup and provides hooks into the game lifecycle.
 * This is the ONLY automa class that Game.ts needs to know about.
 */
export class AutomaGameSetup {
  /** Force-disable unsupported expansions for automa games. Mutates gameOptions in place. */
  public static sanitizeGameOptions(gameOptions: GameOptions): void {
    gameOptions.coloniesExtension = false;
    // turmoilExtension is supported — do not force-disable
    gameOptions.aresExtension = false;
    gameOptions.moonExpansion = false;
    gameOptions.pathfindersExpansion = false;
    gameOptions.ceoExtension = false;
    gameOptions.starWarsExpansion = false;
    gameOptions.underworldExpansion = false;
    gameOptions.communityCardsOption = false;
    gameOptions.solarPhaseOption = false; // Venus Solar Phase Step 2 replaced by Government Intervention card
    gameOptions.boardName = BoardName.THARSIS;
  }

  /** Filter out milestones not supported against MarsBot (e.g., Terraformer29). */
  /** Filter milestones unsupported against MarsBot. */
  public static filterMilestones(milestones: Array<IMilestone>, gameOptions: GameOptions): Array<IMilestone> {
    const unsupported: Array<string> = ['Terraformer29'];
    if (!gameOptions.venusNextExtension) {
      unsupported.push('Planetologist', 'Trader', 'Merchant');
    }
    if (!gameOptions.turmoilExtension) {
      unsupported.push('Lobbyist');
    }
    return milestones.filter((m) => !unsupported.includes(m.name));
  }

  /** Filter awards unsupported against MarsBot. */
  public static filterAwards(awards: Array<IAward>, gameOptions: GameOptions): Array<IAward> {
    const unsupported: Array<string> = [];
    if (!gameOptions.venusNextExtension) {
      unsupported.push('Venuphile');
    }
    return unsupported.length > 0 ? awards.filter((a) => !unsupported.includes(a.name)) : awards;
  }

  /** Filter out cards not supported against MarsBot (e.g., Recession). */
  public static filterPreludeCards<T extends ICard>(cards: Array<T>, gameOptions: GameOptions): Array<T> {
    if (gameOptions.prelude2Expansion) {
      return cards.filter((c) => c.name !== CardName.RECESSION);
    }
    return cards;
  }

  /** Create the MarsBot player instance for the game engine. */
  public static createMarsBotPlayer(gameId: GameId): IPlayer {
    const playerId = safeCast('p-' + gameId + '-marsbot', isPlayerId);
    return new Player('MarsBot', 'bronze', false, 0, playerId);
  }

  /** Get the MarsBot board data for the selected map. */
  public static getBoardData(boardName: BoardName, venusEnabled: boolean): ReadonlyArray<TrackDefinition> {
    switch (boardName) {
    case BoardName.THARSIS:
      return venusEnabled ? THARSIS_MARSBOT_BOARD_WITH_VENUS : THARSIS_MARSBOT_BOARD;
    default:
      throw new Error(`Automa board data not available for ${boardName}. Only Tharsis is currently supported.`);
    }
  }

  /** Set up MarsBot and return the AutomaGameHooks instance for Game.ts to use. */
  public static setup(game: IGame, humanPlayer: IPlayer, gameOptions: GameOptions, rng: Random, existingPlayer?: IPlayer): AutomaGameHooks {
    const boardData = AutomaGameSetup.getBoardData(gameOptions.boardName, gameOptions.venusNextExtension);
    const marsBotPlayer = existingPlayer ?? AutomaGameSetup.createMarsBotPlayer(game.id);

    // Set MarsBot player's game reference
    marsBotPlayer.setup(game);
    // T-2: Turmoil reduces MarsBot's starting TR by 10 (to 10 TR)
    const startingTR = gameOptions.turmoilExtension ? MARSBOT_STARTING_TR - 10 : MARSBOT_STARTING_TR;
    marsBotPlayer.setTerraformRating(startingTR);

    // Override stock/production to intercept resource removal and production decrease
    const marsBotStock = new MarsBotStock(marsBotPlayer);
    const marsBotProduction = new MarsBotProduction(marsBotPlayer);
    (marsBotPlayer as any).stock = marsBotStock;
    (marsBotPlayer as any).production = marsBotProduction;

    const marsBot = new MarsBot(game, marsBotPlayer, humanPlayer, boardData, gameOptions.automaDifficulty, rng);

    // Wire MarsBot reference into overridden stock/production
    marsBotStock.setMarsBot(marsBot);
    marsBotProduction.setMarsBot(marsBot);

    // Override tag counting to use track positions instead of played cards
    marsBotPlayer.tags = new MarsBotTags(marsBotPlayer, marsBot.board);

    // Add MarsBot to human's opponents so cards that target opponents can see MarsBot
    (humanPlayer.opponents as Array<IPlayer>).push(marsBotPlayer);

    // Wire MarsBot manager ref into turn resolver (for corp cube triggers)
    marsBot.turnResolver.marsBotManager = marsBot;

    // Only for new games, not deserialization
    if (existingPlayer === undefined) {
      // T-1: Add MarsBot's 7 delegates to the reserve (Turmoil setup)
      if (gameOptions.turmoilExtension && game.turmoil !== undefined) {
        game.turmoil.delegateReserve.add(marsBotPlayer, DELEGATES_PER_PLAYER);
        game.log('MarsBot: 7 delegates placed in reserve (Turmoil)');
      }
      marsBot.buildInitialActionDeck();
      AutomaGameSetup.placeColonyCubes(game, marsBot);
      game.log('MarsBot is ready with ${0} difficulty', (b) => b.rawString(gameOptions.automaDifficulty));
    }

    return new AutomaGameHooks(game, marsBot);
  }

  /**
   * Pioneer4 milestone and Constructor award place colony cubes on MarsBot's tracks.
   * When MarsBot reaches these positions, it loses 5 MC and builds a colony (if Colonies enabled).
   */
  private static placeColonyCubes(game: IGame, marsBot: MarsBot): void {
    const hasPioneer4 = game.milestones.some((m) => m.name === 'Pioneer4');
    const hasConstructor = game.awards.some((a) => a.name === 'Constructor');
    if (!hasPioneer4 && !hasConstructor) return;

    const spaceTrack = marsBot.board.getTrackIndexForTag(Tag.SPACE);
    const energyTrack = marsBot.board.getTrackIndexForTag(Tag.POWER);
    if (spaceTrack === undefined || energyTrack === undefined) return;

    const cubePositions: Array<{trackIndex: number, position: number}> = [
      {trackIndex: spaceTrack, position: 7},
      {trackIndex: spaceTrack, position: 10},
      {trackIndex: energyTrack, position: 8},
    ];

    for (const {trackIndex, position} of cubePositions) {
      const key = trackCubeKey(trackIndex, position);
      if (!marsBot.trackCubePositions.has(key)) {
        marsBot.trackCubePositions.set(key, {trackIndex, position, cubeType: 'black'});
      }
    }

    marsBot.hasColonyCubes = true;
    marsBot.colonyCubePositions = new Set(cubePositions.map((c) => trackCubeKey(c.trackIndex, c.position)));
    game.log('MarsBot: colony cubes placed on tracks');
  }
}
