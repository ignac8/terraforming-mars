import {IMarsBotCorp, trackCubeKey} from '../MarsBotCorpTypes';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../../cards/IProjectCard';
import {Random} from '../../../common/utils/Random';
import {GameOptions} from '../../game/GameOptions';
import {getAllMarsBotCorps} from './MarsBotCorpRegistry';
import {selectRandomColony, placeColonyForMarsBot} from '../colonies/MarsBotColonyPlacer';
import type {MarsBot} from '../MarsBot';

/**
 * Orchestrates MarsBot corporation lifecycle: selection, setup, cube triggers, per-gen effects.
 */
export class MarsBotCorpResolver {
  public static selectCorp(humanCorpName: CardName, gameOptions: GameOptions, rng: Random): IMarsBotCorp {
    const allCorps = getAllMarsBotCorps();
    const eligible = allCorps.filter((c) => c.name !== humanCorpName &&
      (c.requiredExpansions === undefined || c.requiredExpansions.some((expansion) => gameOptions.expansions[expansion])));
    if (eligible.length === 0) {
      throw new Error('No MarsBot corps registered');
    }
    return eligible[rng.nextInt(eligible.length)];
  }

  /**
   * Run corp setup: place track cubes, resolve starting tags, call setup box.
   */
  public static setupCorp(corp: IMarsBotCorp, marsBot: MarsBot): void {
    // 1. Place track cubes, skipping tracks this game's board lacks (Venus without Venus Next)
    if (corp.trackCubes !== undefined) {
      for (const cube of corp.trackCubes) {
        if (cube.trackIndex >= marsBot.marsBotBoard.tracks.length) {
          continue;
        }
        marsBot.trackCubePositions.set(trackCubeKey(cube.trackIndex, cube.position), cube);
      }
    }

    // 2. Call corp-specific setup (rulebook B, p.1: the Setup box resolves before the starting tags)
    if (corp.setup !== undefined) {
      corp.setup(marsBot);
    }

    // 3. Resolve starting tags as if they were shown on a revealed card (rulebook B, setup step 4):
    // advance tracks, then run the corp's own and the human's card effects. The corp's ongoing
    // effect is already active, so it sees them (Ecotec: "including the starting tag").
    for (const tag of corp.tags) {
      const trackIndex = marsBot.marsBotBoard.tagToTrack[tag];
      if (trackIndex !== undefined) {
        marsBot.turnResolver.advanceTrack(trackIndex);
      }
      corp.effect?.onTagResolved?.(marsBot, tag);
    }

    if (corp.tags.length > 0) {
      // The starting tags stand in for the tags of a project card, so effects that trigger on a
      // card's tags (Arclight, Pharmacy Union, Saturn Systems) fire for them too.
      const tagsCard = {name: corp.name, type: CardType.CORPORATION, tags: [...corp.tags], cost: 0, requirements: [], metadata: {}} as unknown as IProjectCard;
      corp.effect?.onProjectCardResolved?.(marsBot, tagsCard);
      // FAQ: trigger human corp callbacks for MarsBot's starting tags
      // e.g., if human plays Saturn Systems and MarsBot has Jovian starting tag
      marsBot.turnResolver.notifyPlayerCards(tagsCard);
    }
  }

  /**
   * Called when a track advances to a new position. Checks for cube triggers.
   *
   * Returns true when a corp cube replaced the icon printed on that space, so the caller
   * leaves the icon unresolved.
   */
  public static onTrackAdvanced(marsBot: MarsBot, trackIndex: number, position: number): boolean {
    const cube = marsBot.hasCubeAt(trackIndex, position);
    if (cube === undefined) {
      return false;
    }
    const firstVisit = !marsBot.isCubeTriggered(trackIndex, position);
    marsBot.markCubeTriggered(trackIndex, position);

    // Only the corp's own cubes reach its handler. The colony and trade fleet cubes below are
    // rule cubes that sit on the same tracks.
    const corp = marsBot.corp;
    const corpCube = corp?.trackCubes?.find((c) => c.trackIndex === trackIndex && c.position === position);
    const triggers = firstVisit || corp?.trackCubesTriggerEveryAdvance === true;
    const replacedIcon = corpCube !== undefined && triggers &&
      corp?.effect?.onTrackCubeTrigger?.(marsBot, trackIndex, position, corpCube.cubeType) === true;
    if (!firstVisit) {
      return replacedIcon;
    }

    // Colony cubes (Pioneer4/Constructor): positions set by AutomaGameSetup
    // C-X3: deduct 5 MC then place a colony on a randomly selected eligible tile
    if (marsBot.hasColonyCubes && marsBot.colonyCubePositions.has(trackCubeKey(trackIndex, position))) {
      const cost = 5;
      marsBot.turnResolver.megacredits = Math.max(0, marsBot.turnResolver.megacredits - cost);
      marsBot.game.log('MarsBot loses ${0} MC for colony cube trigger (C-X3)', (b) => b.number(cost));
      const colony = selectRandomColony(marsBot.game, marsBot);
      if (colony !== undefined) {
        placeColonyForMarsBot(colony, marsBot);
      } else {
        marsBot.game.log('MarsBot colony cube: no eligible colony tile — Failed Action (C-X3)');
        marsBot.turnResolver.failedAction();
      }
    }

    // 2nd Trade Fleet cube (Colonies, C-6/C-27): unlock when Energy track position 9 is reached
    if (marsBot.tradeFleetCubeKey !== undefined &&
        marsBot.tradeFleetCubeKey === trackCubeKey(trackIndex, position) &&
        !marsBot.hasSecondTradeFleet) {
      marsBot.hasSecondTradeFleet = true;
      marsBot.game.log('MarsBot unlocks 2nd Trade Fleet — Extended Shipping Lines available next generation (C-27)');
    }

    return replacedIcon;
  }
}
