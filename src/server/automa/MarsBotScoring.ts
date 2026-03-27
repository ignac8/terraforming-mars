import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {DifficultyLevel, getAutomaMaxGeneration, getMcPerVP} from '../../common/automa/AutomaTypes';
import {MarsBotTurnResolver} from './MarsBotTurnResolver';
import {IProjectCard} from '../cards/IProjectCard';
import {Space} from '../boards/Space';
import {Board} from '../boards/Board';

export interface MarsBotVPBreakdown {
  terraformRating: number;
  milestones: number;
  awards: number;
  greenery: number;
  cityAdjacentGreenery: number;
  neuralInstance: number;
  mcToVP: number;
  cardVP: number; // Only in Hard/Brutal mode
  total: number;
}

/**
 * Calculates MarsBot's final score with automa-specific rules.
 */
export class MarsBotScoring {
  constructor(
    private readonly game: IGame,
    private readonly marsBot: IPlayer,
    private readonly humanPlayer: IPlayer,
    private readonly turnResolver: MarsBotTurnResolver,
    private readonly difficulty: DifficultyLevel,
    private readonly neuralInstanceSpace: Space | undefined,
    private readonly playedProjectCards: ReadonlyArray<IProjectCard> = [],
    private readonly corpVpBonus: number = 0,
  ) {}

  private getMaxGeneration(): number {
    const opts = this.game.gameOptions;
    return getAutomaMaxGeneration(opts.preludeExtension, opts.prelude2Expansion);
  }

  /** Check if MarsBot instantly wins because max generation reached. */
  public isInstantWin(): boolean {
    return this.game.generation >= this.getMaxGeneration();
  }

  /** Calculate MarsBot's complete VP breakdown. */
  public calculate(): MarsBotVPBreakdown {
    const tr = this.marsBot.getTerraformRating();
    const milestones = this.calculateMilestoneVP();
    const awards = this.calculateAwardVP();
    const greenery = this.countGreeneryVP();
    const cityAdjacentGreenery = this.countCityAdjacentGreeneryVP();
    const neuralInstance = this.calculateNeuralInstanceVP();
    const mcToVP = this.calculateMCtoVP();
    const cardVP = this.calculateCardVP();

    return {
      terraformRating: tr,
      milestones,
      awards,
      greenery,
      cityAdjacentGreenery,
      neuralInstance,
      mcToVP,
      cardVP,
      total: tr + milestones + awards + greenery + cityAdjacentGreenery + neuralInstance + mcToVP + cardVP + this.corpVpBonus,
    };
  }

  private calculateMilestoneVP(): number {
    return this.game.claimedMilestones
      .filter((cm) => cm.player === this.marsBot)
      .length * 5;
  }

  private calculateAwardVP(): number {
    let vp = 0;
    for (const fa of this.game.fundedAwards) {
      const award = fa.award;
      // Get all players' scores for this award
      const marsBotScore = this.turnResolver.getMarsBotAwardValue(award);
      const humanScore = award.getScore(this.humanPlayer);

      // Determine placement
      if (marsBotScore > humanScore) {
        vp += 5; // 1st place
      } else if (marsBotScore === humanScore) {
        vp += 5; // Tied for 1st = both get 5 (in 2-player)
      } else {
        vp += 2; // 2nd place in 2-player
      }
    }
    return vp;
  }

  private countGreeneryVP(): number {
    return this.game.board.getGreeneries(this.marsBot).length;
  }

  private countCityAdjacentGreeneryVP(): number {
    let vp = 0;
    for (const space of this.game.board.getCities(this.marsBot)) {
      const adj = this.game.board.getAdjacentSpaces(space);
      vp += adj.filter((s) => Board.isGreenerySpace(s)).length;
    }
    return vp;
  }

  private calculateNeuralInstanceVP(): number {
    if (this.neuralInstanceSpace === undefined) return 0;
    const adj = this.game.board.getAdjacentSpaces(this.neuralInstanceSpace);
    // 1 VP per adjacent space NOT occupied by human (empty or MarsBot-owned)
    return adj.filter((s) => s.player !== this.humanPlayer).length;
  }

  private calculateMCtoVP(): number {
    if (this.game.generation >= this.getMaxGeneration()) return 0;
    const opts = this.game.gameOptions;
    const mcPerVP = getMcPerVP(this.game.generation, opts.preludeExtension, opts.prelude2Expansion);
    if (mcPerVP === undefined) return 0;
    return Math.floor(this.turnResolver.mcSupply / mcPerVP);
  }

  /** Hard/Brutal mode: 1 VP per card with non-negative VP icon in MarsBot's played pile. */
  private calculateCardVP(): number {
    if (this.difficulty !== 'hard' && this.difficulty !== 'brutal') return 0;
    return this.playedProjectCards.filter((card) => {
      const vp = card.getVictoryPoints(this.marsBot);
      return vp >= 0;
    }).length;
  }
}
