import {MarsBotCorp} from '../MarsBotCorp';
import {corpTrackCubes, trackCubeKey} from '../corpTrackCubes';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../../cards/IProjectCard';
import {Random} from '../../../common/utils/Random';
import {GameOptions} from '../../game/GameOptions';
import {getAllMarsBotCorps} from './MarsBotCorpRegistry';
import {selectRandomColony, placeColony} from '../colonies/MarsBotColonyPlacer';
import type {MarsBot} from '../MarsBot';

/** MarsBot's corporation: how it is chosen, set up and triggered by track cubes. */
export class MarsBotCorpResolver {
  public static selectCorp(humanCorpName: CardName, gameOptions: GameOptions, rng: Random): MarsBotCorp {
    const allCorps = getAllMarsBotCorps();
    const eligible = allCorps.filter((c) => c.name !== humanCorpName &&
      (c.requiredExpansions === undefined || c.requiredExpansions.some((expansion) => gameOptions.expansions[expansion])));
    if (eligible.length === 0) {
      throw new Error('No MarsBot corps registered');
    }
    return eligible[rng.nextInt(eligible.length)];
  }

  /** Sets up `corp` for `marsBot`: places its track cubes, runs its setup box, then resolves its starting tags. */
  public static setupCorp(corp: MarsBotCorp, marsBot: MarsBot): void {
    // 1. Place track cubes, skipping tracks this game's board lacks (Venus without Venus Next).
    // A save keeps the positions, so a restored game never re-resolves them.
    for (const cube of corpTrackCubes(corp, marsBot.marsBotBoard)) {
      marsBot.trackCubePositions.set(trackCubeKey(cube.trackIndex, cube.position), cube);
    }

    // 2. The Setup box resolves before the starting tags (rulebook B, p.1)
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
      corp.onTagResolved?.(marsBot, tag);
    }

    if (corp.tags.length > 0) {
      // The starting tags stand in for the tags of a project card, so effects that trigger on a
      // card's tags (Arclight, Pharmacy Union, Saturn Systems) fire for them too.
      const tagsCard = {name: corp.name, type: CardType.CORPORATION, tags: [...corp.tags], cost: 0, requirements: [], metadata: {}} as unknown as IProjectCard;
      corp.onProjectCardResolved?.(marsBot, tagsCard);
      // FAQ: the player's cards see the starting tags too, e.g. Saturn Systems for a Jovian one.
      marsBot.turnResolver.notifyPlayerCards(tagsCard);
    }
  }

  /**
   * Fires the track cube at `position` on track `trackIndex`, if one is there, once MarsBot's track has advanced to it.
   *
   * Returns true when a corp cube replaced the icon printed on that space, so the caller
   * leaves the icon unresolved. With `corpCubesOnly` the colony and trade fleet cubes stay
   * untouched, for the final greenery move after the game has ended.
   */
  public static onTrackAdvanced(marsBot: MarsBot, trackIndex: number, position: number, corpCubesOnly: boolean = false): boolean {
    const cube = marsBot.hasCubeAt(trackIndex, position);
    if (cube === undefined) {
      return false;
    }
    const firstVisit = !marsBot.isCubeTriggered(trackIndex, position);
    marsBot.markCubeTriggered(trackIndex, position);

    // Only the corp's own cubes reach its handler. The colony and trade fleet cubes below are
    // rule cubes that sit on the same tracks.
    const corp = marsBot.corp;
    const corpCube = corp === undefined ? undefined :
      corpTrackCubes(corp, marsBot.marsBotBoard).find((c) => c.trackIndex === trackIndex && c.position === position);
    const triggers = firstVisit || corp?.trackCubesTriggerEveryAdvance === true;
    const replacedIcon = corpCube !== undefined && triggers &&
      corp?.onTrackCubeTrigger?.(marsBot, trackIndex, position, corpCube.cubeType) === true;
    if (!firstVisit || corpCubesOnly) {
      return replacedIcon;
    }

    // Colony cubes (modular Pioneer and Constructor), set by `AutomaGameSetup`, cost 5 M€ and build a colony
    // on a random eligible tile (rulebook C, p.14)
    if (marsBot.hasColonyCubes && marsBot.colonyCubePositions.has(trackCubeKey(trackIndex, position))) {
      const cost = 5;
      marsBot.megacredits = Math.max(0, marsBot.megacredits - cost);
      marsBot.game.log('MarsBot loses ${0}:r:mc: for its colony cube', (b) => b.number(cost));
      const colony = selectRandomColony(marsBot);
      if (colony !== undefined) {
        placeColony(colony, marsBot);
      } else {
        marsBot.game.log('MarsBot: no colony tile to build on, Failed Action');
        marsBot.turnResolver.failedAction();
      }
    }

    // 2nd Trade Fleet cube (Colonies, rulebook C, p.4 and p.6): unlock when the Energy track reaches the cube
    if (marsBot.tradeFleetCubeKey !== undefined &&
        marsBot.tradeFleetCubeKey === trackCubeKey(trackIndex, position) &&
        !marsBot.hasSecondTradeFleet) {
      marsBot.hasSecondTradeFleet = true;
      marsBot.game.log('MarsBot unlocks 2nd Trade Fleet: Extended Shipping Lines available next generation (C-27)');
    }

    return replacedIcon;
  }
}
