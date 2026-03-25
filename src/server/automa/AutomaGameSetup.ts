import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Player} from '../Player';
import {GameOptions} from '../game/GameOptions';
import {GameId, isPlayerId, safeCast} from '../../common/Types';
import {Random} from '../../common/utils/Random';
import {MarsBot} from './MarsBot';
import {THARSIS_MARSBOT_BOARD} from './boards/TharsisMarsBot';
import {MarsBotBoardData} from '../../common/automa/AutomaTypes';
import {BoardName} from '../../common/boards/BoardName';
import {MARSBOT_STARTING_TR} from '../../common/automa/AutomaTypes';
import {AutomaGameHooks} from './AutomaGameHooks';
import {MarsBotTags} from './MarsBotTags';
import {MarsBotStock, MarsBotProduction} from './MarsBotStock';
import {CardName} from '../../common/cards/CardName';
import {ICard} from '../cards/ICard';

/**
 * Handles automa-specific game setup and provides hooks into the game lifecycle.
 * This is the ONLY automa class that Game.ts needs to know about.
 */
export class AutomaGameSetup {
  /** Force-disable unsupported expansions for automa games. Mutates gameOptions in place. */
  public static sanitizeGameOptions(gameOptions: GameOptions): void {
    gameOptions.venusNextExtension = false;
    gameOptions.coloniesExtension = false;
    gameOptions.turmoilExtension = false;
    gameOptions.aresExtension = false;
    gameOptions.moonExpansion = false;
    gameOptions.pathfindersExpansion = false;
    gameOptions.ceoExtension = false;
    gameOptions.starWarsExpansion = false;
    gameOptions.underworldExpansion = false;
    gameOptions.communityCardsOption = false;
    gameOptions.boardName = BoardName.THARSIS;
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
  public static getBoardData(boardName: BoardName): MarsBotBoardData {
    switch (boardName) {
    case BoardName.THARSIS:
      return THARSIS_MARSBOT_BOARD;
    default:
      throw new Error(`Automa board data not available for ${boardName}. Only Tharsis is currently supported.`);
    }
  }

  /** Set up MarsBot and return the AutomaGameHooks instance for Game.ts to use. */
  public static setup(game: IGame, humanPlayer: IPlayer, gameOptions: GameOptions, rng: Random): AutomaGameHooks {
    const boardData = AutomaGameSetup.getBoardData(gameOptions.boardName);
    const marsBotPlayer = AutomaGameSetup.createMarsBotPlayer(game.id);

    // Set MarsBot player's game reference
    marsBotPlayer.setup(game);
    marsBotPlayer.setTerraformRating(MARSBOT_STARTING_TR);

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

    marsBot.buildInitialActionDeck();

    game.log('MarsBot is ready with ${0} difficulty', (b) => b.rawString(gameOptions.automaDifficulty));

    return new AutomaGameHooks(game, marsBot);
  }
}
