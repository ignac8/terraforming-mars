import {IGame} from '../IGame';
import {getAutomaMaxGeneration} from '../../common/automa/AutomaTypes';
import {BoardName} from '../../common/boards/BoardName';
import {IMarsBot} from './IMarsBot';
import {Space} from '../boards/Space';
import {Board} from '../boards/Board';
import {MADetail} from '../../common/game/VictoryPointsBreakdown';
import {Turmoil} from '../turmoil/Turmoil';
import {printedVictoryPoints} from './MarsBotTags';
import {sum} from '../../common/utils/utils';

export interface MarsBotVPBreakdown {
  terraformRating: number;
  milestones: number;
  awards: number;
  greenery: number;
  cityAdjacentGreenery: number;
  neuralInstance: number;
  mcToVP: number;
  cardVP: number; // Only in Hard/Brutal mode
  vermin: number;
  leftoverResourcesVP: number; // With automaColonyVP: 1 VP per 2 resources left on the shipping board and Venus floaters
  turmoilVP: number; // T-13: 1 VP per party leader or chairman position
  corpVP: number; // VP the corporation adds at the end (Viron)
  total: number;
  detailsMilestones: Array<MADetail>;
  detailsAwards: Array<MADetail>;
}

/**
 * Calculates MarsBot's final score with automa-specific rules.
 */
export class MarsBotScoring {
  constructor(
    private readonly marsBot: IMarsBot,
  ) {}

  /** Calculate MarsBot's complete VP breakdown. */
  public calculate(): MarsBotVPBreakdown {
    const tr = this.marsBot.player.terraformRating;
    const milestoneResult = this.calculateMilestoneVP();
    const awardResult = this.calculateAwardVP();
    const greenery = this.countGreeneryVP();
    const cities = this.marsBot.game.board.getCities(this.marsBot.player);
    const cityAdjacentGreenery = this.countCityAdjacentGreeneryVP(cities);
    const neuralInstance = this.calculateNeuralInstanceVP();
    const mcToVP = this.calculateMCtoVP();
    const cardVP = this.calculateCardVP();
    const vermin = this.calculateVerminPenalty(cities);
    const leftoverResourcesVP = this.calculateLeftoverResourcesVP();
    const turmoilVP = this.calculateTurmoilVP();
    const corpVP = this.marsBot.corpVictoryPoints();

    return {
      terraformRating: tr,
      milestones: milestoneResult.total,
      awards: awardResult.total,
      greenery,
      cityAdjacentGreenery,
      neuralInstance,
      mcToVP,
      cardVP,
      vermin,
      leftoverResourcesVP,
      turmoilVP,
      corpVP,
      total: tr + milestoneResult.total + awardResult.total + greenery + cityAdjacentGreenery + neuralInstance + mcToVP + cardVP + vermin + leftoverResourcesVP + turmoilVP + corpVP,
      detailsMilestones: milestoneResult.details,
      detailsAwards: awardResult.details,
    };
  }

  private calculateMilestoneVP(): {total: number, details: Array<MADetail>} {
    const details: Array<MADetail> = [];
    let total = 0;
    for (const cm of this.marsBot.game.claimedMilestones) {
      if (cm.player === this.marsBot.player) {
        total += 5;
        details.push({message: 'Claimed ${0} milestone', messageArgs: [cm.milestone.name], victoryPoint: 5});
      }
    }
    return {total, details};
  }

  private calculateAwardVP(): {total: number, details: Array<MADetail>} {
    const details: Array<MADetail> = [];
    let total = 0;
    for (const fa of this.marsBot.game.fundedAwards) {
      const award = fa.award;
      const marsBotScore = this.marsBot.awardValue(award);
      const humanScore = award.getScore(this.marsBot.humanPlayer);

      if (marsBotScore >= humanScore) {
        total += 5;
        details.push({message: '${0} place for ${1} award (funded by ${2})', messageArgs: ['1st', award.name, fa.player.name], victoryPoint: 5});
      }
    }
    return {total, details};
  }

  private countGreeneryVP(): number {
    return this.marsBot.game.board.getGreeneries(this.marsBot.player).length;
  }

  private countCityAdjacentGreeneryVP(cities: ReadonlyArray<Space>): number {
    let vp = 0;
    for (const space of cities) {
      const adj = this.marsBot.game.board.getAdjacentSpaces(space);
      vp += adj.filter((s) => Board.isGreenerySpace(s)).length;
    }
    return vp;
  }

  private calculateNeuralInstanceVP(): number {
    if (this.marsBot.neuralInstanceSpace === undefined) {
      return 0;
    }
    const adj = this.marsBot.game.board.getAdjacentSpaces(this.marsBot.neuralInstanceSpace);
    // 1 VP per adjacent space NOT occupied by human (empty or MarsBot-owned)
    return adj.filter((s) => s.player !== this.marsBot.humanPlayer).length;
  }

  private calculateMCtoVP(): number {
    const mcPerVP = currentMcPerVP(this.marsBot.game);
    if (mcPerVP === undefined) {
      return 0;
    }
    return Math.floor(this.marsBot.megacredits / mcPerVP);
  }

  /** Vermin: -1 VP per city when 10+ animals on Vermin card. Applies to ALL players. */
  private calculateVerminPenalty(cities: ReadonlyArray<Space>): number {
    if (!this.marsBot.game.verminInEffect) {
      return 0;
    }
    return -1 * cities.length;
  }

  /** Hard/Brutal mode: 1 VP per card with a non-negative VP icon in MarsBot's played pile. */
  private calculateCardVP(): number {
    if (this.marsBot.difficulty !== 'hard' && this.marsBot.difficulty !== 'brutal') {
      return 0;
    }
    // Designer ruling, BGG thread 3386410 (TDaver): a card with no VP icon doesn't count, one
    // with a conditional or per-resource icon does, and a negative icon doesn't.
    return this.marsBot.playedProjectCards.filter((card) => {
      const vp = printedVictoryPoints(card);
      return vp !== undefined && vp >= 0;
    }).length;
  }

  /**
   * Optional (automaColonyVP): each resource MarsBot has left on its Colonies shipping board, and
   * each of its floaters on the Venus board, is worth half a VP, rounded down.
   *
   * The rulebook doesn't score them; it is the designer's intent (TDaver, BGG 3408751, 3373832).
   */
  private calculateLeftoverResourcesVP(): number {
    if (!this.marsBot.game.gameOptions.automaColonyVP || !this.marsBot.game.gameOptions.coloniesExtension) {
      return 0;
    }
    return Math.floor((sum(Array.from(this.marsBot.shippingBoard.storage.values())) + this.marsBot.floaters) / 2);
  }

  /** T-13: 1 VP for each Party Leader or Chairman position MarsBot holds. */
  private calculateTurmoilVP(): number {
    if (!this.marsBot.game.gameOptions.turmoilExtension || this.marsBot.game.turmoil === undefined) {
      return 0;
    }
    return Turmoil.getTurmoil(this.marsBot.game).getVictoryPoints(this.marsBot.player);
  }
}

function buildMcToVpTable(maxGen: number): ReadonlyArray<{maxGeneration: number, mcPerVP: number}> {
  const table: Array<{maxGeneration: number, mcPerVP: number}> = [];
  for (let mcPerVP = 8; mcPerVP >= 1; mcPerVP--) {
    table.push({maxGeneration: maxGen - mcPerVP, mcPerVP});
  }
  return table;
}

/** M€ per VP in `generation` on `boardName`, or undefined from the generation limit on. */
export function getMcPerVP(generation: number, preludeExtension: boolean, boardName: BoardName): number | undefined {
  const table = buildMcToVpTable(getAutomaMaxGeneration(preludeExtension, boardName));
  const entry = table.find((e) => generation <= e.maxGeneration);
  return entry?.mcPerVP;
}

/**
 * MC per VP for the generation the game is in, or undefined once the generation limit is reached.
 *
 * Without a generation limit the table's last row (1 MC per VP) applies from then on.
 */
export function currentMcPerVP(game: IGame): number | undefined {
  const opts = game.gameOptions;
  const maxGeneration = getAutomaMaxGeneration(opts.preludeExtension, opts.boardName);
  let generation = game.generation;
  if (opts.automaNoGenerationLimit) {
    generation = Math.min(generation, maxGeneration - 1);
  } else if (generation >= maxGeneration) {
    return undefined;
  }
  return getMcPerVP(generation, opts.preludeExtension, opts.boardName);
}
