import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {CardResource} from '../../common/CardResource';
import {GlobalParameter} from '../../common/GlobalParameter';
import {Board, isSpecialTileSpace} from '../boards/Board';
import {GlobalParameterTracks} from '../boards/GlobalParameterTracks';
import {venusStepsBetween} from '../venusNext/venusScale';
import {MarsBotBonusCard, MarsBotBonusDeckCard, bonusCardDisplayName} from './MarsBotBonusCard';
import {MarsBotBonusDeck} from './MarsBotBonusDeck';
import {MarsBotTilePlacer} from './MarsBotTilePlacer';
import {MarsBotTurnResolver} from './MarsBotTurnResolver';
import {IProjectCard} from '../cards/IProjectCard';
import {ICard} from '../cards/ICard';
import {CardType} from '../../common/cards/CardType';
import {Space} from '../boards/Space';
import {SpaceType} from '../../common/boards/SpaceType';
import {BoardName} from '../../common/boards/BoardName';
import {marsBotUsesBoardGoals} from './MarsBotMilestoneAwardEval';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {cardTagsIncludingEvent} from './MarsBotTags';
import {MarsBotTurmoilHelper} from './turmoil/MarsBotTurmoilHelper';
import {pickByFlippedCard} from './MarsBotCardFlip';
import {selectTradeColony, tradeWithColony} from './colonies/MarsBotTrader';
import type {MarsBot} from './MarsBot';
import {ACTION_DECK_BONUS_CARD_REMOVED} from './IMarsBotCorp';
import {MARSBOT_BONUS_CARD_EFFECTS} from './bonusCards/MarsBotBonusCardEffects';

/**
 * Resolves MarsBot's bonus cards: looks up the effect of a card and lends it the tools the effects share.
 */
export class MarsBotBonusResolver {
  public readonly tilePlacer: MarsBotTilePlacer;
  /** Callback to set the Neural Instance space on the MarsBot manager. */
  public onNeuralInstancePlaced: ((space: Space) => void) | undefined;

  /** Reference to the full MarsBot manager (set post-construction; needed for Colonies cards). */
  public marsBotManager: MarsBot | undefined;

  constructor(
    public readonly game: IGame,
    public readonly botPlayer: IPlayer,
    public readonly humanPlayer: IPlayer,
    public readonly turnResolver: MarsBotTurnResolver,
    public readonly bonusDeck: MarsBotBonusDeck,
    tilePlacer: MarsBotTilePlacer,
  ) {
    this.tilePlacer = tilePlacer;
  }

  public resolve(card: MarsBotBonusDeckCard): boolean {
    if (card.id === undefined) {
      // A project card from the bonus deck is played, so it leaves the bonus deck
      this.turnResolver.resolveProjectCard(card);
      return false;
    }
    const destroyed = this.resolveEffect(card);
    const marsBot = this.marsBotManager;
    // Only a destroyed card counts for the Land Specialist milestone, not one shuffled back into the deck.
    // A corporation's setup resolves and removes its cards without this (Philares), so it isn't in resolveEffect.
    if (destroyed && marsBot !== undefined && !this.bonusDeck.drawPile.includes(card)) {
      marsBot.destroyedBonusCards++;
    }
    // A corporation's generation card that removes itself does not come back (Vitor's Overachievement)
    if (destroyed && marsBot !== undefined && card.id === marsBot.corp?.actionDeckBonusCard) {
      marsBot.setCorpState(ACTION_DECK_BONUS_CARD_REMOVED, 1);
    }
    // A card that returns to the action deck every generation waits outside the bonus deck
    if (!destroyed && marsBot?.returnsToActionDeck(card) !== true) {
      this.bonusDeck.discard(card);
    }
    return destroyed;
  }

  /**
   * Resolve a bonus card's effect.
   *
   * Returns true when the card must not be discarded: it was destroyed, or it went back into the bonus deck.
   */
  public resolveEffect(card: MarsBotBonusCard): boolean {
    return MARSBOT_BONUS_CARD_EFFECTS[card.id]?.resolve(this, card) ?? false;
  }

  /**
   * Removes the player's animal or microbe worth the most VP (Invasive Species, and Corporate
   * Competition's Excentric). False when no card has one MarsBot may remove.
   *
   * Cards that score their resources come first, then the rest; a tie goes to a flipped project
   * card (BGG 3360797).
   */
  public maybeRemoveAnimalOrMicrobe(source: string): boolean {
    // Protected Habitat blocks animal/microbe removal
    const isProtected = this.humanPlayer.playedCards.has(CardName.PROTECTED_HABITATS);

    // Pets and Bioengineering Enclosure protect their resources from opponents
    const candidates = isProtected ? [] : this.humanPlayer.playedCards.filter((played) =>
      (played.resourceCount ?? 0) > 0 && played.protectedResources !== true &&
      (played.resourceType === CardResource.ANIMAL || played.resourceType === CardResource.MICROBE));
    if (candidates.length > 0) {
      const best = Math.max(...candidates.map(vpPerResource));
      const tied = candidates.filter((played) => vpPerResource(played) === best);
      const card = tied.length > 1 ? pickByFlippedCard(this.game, tied) ?? tied[0] : tied[0];
      this.humanPlayer.removeResourceFrom(card, 1, {removingPlayer: this.botPlayer, log: false});
      this.game.log('MarsBot\'s ${0}: removed 1 ${1} from ${2}',
        (b) => b.rawString(source).rawString(card.resourceType ?? '').card(card));
      return true;
    }
    if (isProtected) {
      this.game.log('MarsBot\'s ${0}: blocked by Protected Habitats', (b) => b.rawString(source));
    } else {
      this.game.log('MarsBot\'s ${0}: no animal/microbe resources to remove', (b) => b.rawString(source));
    }
    return false;
  }

  /** Lobbyists branch (c): an ocean space next to 2+ oceans takes an ocean. */
  public lobbyistsOceanBranch(source: string = 'Lobbyists'): boolean {
    if (!this.game.canAddOcean()) {
      return false;
    }
    const space = this.tilePlacer.findOceanSpace((s) =>
      this.game.board.getAdjacentSpaces(s).filter((a) => Board.isOceanSpace(a) && a.tile !== undefined).length >= 2);
    if (space === undefined) {
      return false;
    }
    if (this.interceptsRaise(GlobalParameter.OCEANS)) {
      this.game.log(`MarsBot skips the ocean (${source})`);
      return true;
    }
    this.game.addOcean(this.botPlayer, space);
    this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(space));
    this.game.log(`MarsBot places ocean (${source})`);
    return true;
  }

  /**
   * Counts the steps from `level` to the nearer of the next bonus step printed on the map's `type` track and
   * the track's maximum.
   *
   * A temperature step is 2 degrees, an oxygen step 1%, and a Venus step 2% up to 30%, then 1%.
   * Returns 0 when the track is at its maximum.
   */
  public stepsToNextBonus(type: keyof GlobalParameterTracks, level: number): number {
    const next = Math.min(
      this.game.max[type],
      ...this.game.globalParameterTracks[type].map((threshold) => threshold.value).filter((value) => value > level));
    switch (type) {
    case 'temperature':
      return (next - level) / 2;
    case 'oxygen':
      return next - level;
    case 'venus':
      return venusStepsBetween(level, next);
    }
  }

  /** Lobbyists shared branch (a): temperature 1-2 steps from bonus or completion. */
  public lobbyistsTempBranch(source: string = 'Lobbyists'): boolean {
    const stepsToBonus = this.stepsToNextBonus('temperature', this.game.getTemperature());
    if (stepsToBonus >= 1 && stepsToBonus <= 2) {
      // Pristar's cube cancels only the first of the 2 steps
      const steps = this.interceptsRaise(GlobalParameter.TEMPERATURE) ? 1 : 2;
      this.game.increaseTemperature(this.botPlayer, steps);
      this.game.log(`MarsBot raises temperature ${steps} step(s) (${source})`);
      return true;
    }
    return false;
  }

  /** Lobbyists shared branch (b): oxygen 1-2 steps from bonus or completion. */
  public lobbyistsOxygenBranch(source: string = 'Lobbyists'): boolean {
    const stepsToBonus = this.stepsToNextBonus('oxygen', this.game.getOxygenLevel());
    if (stepsToBonus >= 1 && stepsToBonus <= 2) {
      const greenerySpace = this.tilePlacer.findGreenerySpace();
      if (greenerySpace !== undefined) {
        const raiseOxygen = this.game.getOxygenLevel() >= this.game.max.oxygen ||
          !this.interceptsRaise(GlobalParameter.OXYGEN);
        this.game.addGreenery(this.botPlayer, greenerySpace, raiseOxygen);
        this.turnResolver.gainMc(this.tilePlacer.getPlacementBonusMC(greenerySpace) + this.tilePlacer.getOceanAdjacencyMC(greenerySpace));
        if (this.game.getOxygenLevel() < this.game.max.oxygen && !this.interceptsRaise(GlobalParameter.OXYGEN)) {
          this.game.increaseOxygenLevel(this.botPlayer, 1);
        }
        this.game.log(`MarsBot places greenery and raises oxygen twice (${source})`);
        return true;
      }
    }
    return false;
  }

  /**
   * Advances a track for a bonus card. A maxed track stays put: a bonus card that can't resolve
   * takes no Failed Action (rulebook A p.5; BGG 3599965, 3623553).
   */
  public maybeAdvanceTrack(trackIndex: number): void {
    if (!this.turnResolver.marsBotBoard.tracks[trackIndex].canAdvance()) {
      this.game.log('MarsBot: track ${0} at max, no effect', (b) => b.number(trackIndex + 1));
      return;
    }
    this.turnResolver.advanceTrack(trackIndex);
  }

  /** Pristar: true when the corp consumes its cube to skip this raise. */
  public interceptsRaise(parameter: GlobalParameter): boolean {
    return this.marsBotManager?.interceptsParameterRaise(parameter) ?? false;
  }

  /**
   * Places a MarsBot greenery on a space that passes `filter` and raises oxygen.
   *
   * Returns false, with no Failed Action, when no such space is left.
   */
  public maybePlaceGreenery(filter?: (space: Space) => boolean): boolean {
    const space = this.tilePlacer.findGreenerySpace(filter);
    if (space === undefined) {
      return false;
    }
    const raiseOxygen = this.game.getOxygenLevel() >= this.game.max.oxygen ||
      !this.interceptsRaise(GlobalParameter.OXYGEN);
    this.game.addGreenery(this.botPlayer, space, raiseOxygen);
    this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(space));
    return true;
  }

  public turmoilHelper(): MarsBotTurmoilHelper {
    return new MarsBotTurmoilHelper(this.game);
  }

  /** Execute an action and reverse any TR gained (for Government Intervention). */
  public withoutTRGain(action: () => void): void {
    const trBefore = this.botPlayer.terraformRating;
    action();
    const trGained = this.botPlayer.terraformRating - trBefore;
    if (trGained > 0) {
      this.botPlayer.decreaseTerraformRating(trGained);
      this.game.log('MarsBot does not receive TR from Government Intervention');
    }
  }

  /**
   * Execute an action and reverse any TR or M€ gained (for Government Intervention).
   *
   * M€ that Lakefront Resorts' advance brings in stays (rulebook B, p.4).
   */
  public withoutTRorMcGain(action: () => void): void {
    const marsBot = this.marsBotManager;
    const mcBefore = this.turnResolver.megacredits;
    if (marsBot !== undefined) {
      marsBot.mcKeptThroughIntervention = 0;
    }
    let kept = 0;
    try {
      this.withoutTRGain(action);
    } finally {
      kept = marsBot?.mcKeptThroughIntervention ?? 0;
      if (marsBot !== undefined) {
        marsBot.mcKeptThroughIntervention = undefined;
      }
    }
    if (this.turnResolver.megacredits > mcBefore + kept) {
      this.turnResolver.megacredits = mcBefore + kept;
      this.game.log('MarsBot does not receive M€ from Government Intervention');
    }
  }

  public tryHelperAction(awardName: string): boolean {
    const marsBotBoard = this.turnResolver.marsBotBoard;
    const board = this.game.board;
    // A helper that would advance a maxed track is impossible, so MarsBot skips its award
    // instead of taking a Failed Action (rulebook A, p.7).
    const advance = (trackIndex: number) => {
      if (!marsBotBoard.tracks[trackIndex].canAdvance()) {
        return false;
      }
      this.turnResolver.advanceTrack(trackIndex);
      return true;
    };
    const advanceTrackOf = (tag: Tag) => {
      const trackIndex = marsBotBoard.tagToTrack[tag];
      return trackIndex !== undefined && marsBotBoard.tracks[trackIndex].canAdvance() &&
        this.turnResolver.advanceTrackOfTag(tag);
    };
    // Advances the less or the more advanced of two tags' tracks, the upper track when tied. The
    // player's cards see an advance of each named tag on that track (Saturn Systems for Traveller).
    const advanceTrackOfEither = (tags: [Tag, Tag], pick: 'less' | 'more') => {
      const position = (trackIndex: number) => marsBotBoard.tracks[trackIndex].position;
      const trackIndexes = tags.map((tag) => marsBotBoard.tagToTrack[tag])
        .filter((trackIndex) => trackIndex !== undefined)
        .sort((a, b) => a - b);
      if (trackIndexes.length === 0) {
        return false;
      }
      const chosen = trackIndexes.reduce((best, trackIndex) => {
        const better = pick === 'less' ? position(trackIndex) < position(best) : position(trackIndex) > position(best);
        return better ? trackIndex : best;
      });
      if (!advance(chosen)) {
        return false;
      }
      for (const tag of tags) {
        if (marsBotBoard.tagToTrack[tag] === chosen) {
          this.turnResolver.notifyTagAdvance(tag);
        }
      }
      return true;
    };
    const placeCity = (filter?: (space: Space) => boolean) => {
      const space = this.tilePlacer.findCitySpace(filter);
      if (space) {
        this.game.addCity(this.botPlayer, space);
        this.turnResolver.gainMc(this.tilePlacer.getTotalPlacementMC(space));
        return true;
      }
      return false;
    };
    // Reveals cards until one passes `filter`, plays it, then gains `mc`. The discards reshuffle
    // as usual, and it gives up only once every card in the deck has been seen. It stops before
    // drawing from an empty deck, so it never throws.
    const revealAndResolveCard = (filter: (card: IProjectCard) => boolean, mc: number = 0) => {
      const [card] = this.game.projectDeck.drawByConditionOrThrow(this.game, 1, filter);
      if (card === undefined) {
        return false;
      }
      this.game.log('MarsBot reveals ${0} (Corporate Competition)', (b) => b.card(card));
      this.turnResolver.resolveProjectCard(card);
      this.turnResolver.gainMc(mc);
      return true;
    };
    const nextToOcean = (space: Space) => board.getAdjacentSpaces(space).some(Board.isOceanSpace);
    // Vastitas Borealis' Highlander also keeps away from the spaces reserved for an ocean (rulebook C, p.12).
    // The modular Highlander only looks at placed oceans (p.16).
    const vastitasRules = this.marsBotManager !== undefined &&
      marsBotUsesBoardGoals(this.marsBotManager, BoardName.VASTITAS_BOREALIS_NOVA);
    const nextToReservedOcean = (space: Space) =>
      board.getAdjacentSpaces(space).some((s) => s.spaceType === SpaceType.OCEAN);
    const nextToSpecialTile = (space: Space) => board.getAdjacentSpaces(space).some(isSpecialTileSpace);
    const onEdge = (space: Space) => space.edge;
    const inFourBottomRows = (space: Space) => space.y >= 5 && space.y <= 8;

    switch (awardName) {
    // Tharsis (B08)
    case 'Landlord': return this.maybePlaceGreenery();
    case 'Banker': return advanceTrackOfEither([Tag.BUILDING, Tag.EVENT], 'less');
    case 'Scientist': return advanceTrackOf(Tag.SCIENCE);
    case 'Thermalist': return advanceTrackOf(Tag.POWER);
    case 'Miner': return advanceTrackOf(Tag.SPACE);
    // Hellas (B09)
    case 'Cultivator': return this.maybePlaceGreenery();
    case 'Magnate': return revealAndResolveCard((c) => c.type === CardType.AUTOMATED);
    case 'Space Baron': return advanceTrackOf(Tag.SPACE);
    case 'Excentric': return this.maybeRemoveAnimalOrMicrobe('Corporate Competition');
    case 'Contractor': return advanceTrackOf(Tag.BUILDING);
    // Elysium (B10)
    case 'Celebrity': return revealAndResolveCard((c) => c.cost >= 20);
    case 'Industrialist': return advanceTrackOf(Tag.POWER);
    case 'Desert Settler': return this.maybePlaceGreenery(inFourBottomRows);
    case 'Estate Dealer': return this.maybePlaceGreenery(nextToOcean);
    case 'Benefactor': { this.botPlayer.increaseTerraformRating(2); return true; }
    // Utopia Planitia (B11)
    case 'Suburbian': return this.maybePlaceGreenery(onEdge);
    case 'Investor': return advanceTrackOf(Tag.EARTH);
    case 'Botanist': return advanceTrackOf(Tag.PLANT);
    case 'Incorporator': return revealAndResolveCard((c) => c.cost <= 10);
    case 'Metropolist': return placeCity();
    // Terra Cimmeria (B12)
    case 'Electrician': return advanceTrackOf(Tag.POWER);
    case 'Founder': return placeCity(nextToSpecialTile);
    case 'Mogul': return advance(marsBotBoard.getMostAdvancedTrackIndex());
    case 'A. Zoologist':
    case 'Zoologist': return advanceTrackOf(Tag.ANIMAL);
    case 'Forecaster': return revealAndResolveCard((c) => c.requirements.length > 0);
    // Vastitas Borealis (B13). Traveller follows B14, the card for random awards.
    case 'Traveller': return advanceTrackOfEither([Tag.EARTH, Tag.JOVIAN], 'more');
    case 'Landscaper': return this.maybePlaceGreenery();
    case 'Highlander': return this.maybePlaceGreenery((space) => !nextToOcean(space) && !(vastitasRules && nextToReservedOcean(space)));
    case 'Promoter': return advanceTrackOf(Tag.EVENT);
    case 'Blacksmith': return advanceTrackOfEither([Tag.BUILDING, Tag.SPACE], 'more');
    // Milestones and awards (B14)
    case 'Administrator': return revealAndResolveCard((c) => cardTagsIncludingEvent(c).length === 0, 5);
    case 'Biologist': return advanceTrackOf(Tag.MICROBE);
    case 'Collector': return advance(marsBotBoard.getLeastAdvancedTrackIndex());
    case 'Constructor': return placeCity();
    case 'Manufacturer': return advanceTrackOfEither([Tag.BUILDING, Tag.POWER], 'less');
    case 'Politician': return false;
    case 'Supplier': return advanceTrackOf(Tag.POWER);
    case 'Visionary': return advance(marsBotBoard.getLeastAdvancedTrackIndex(true));
    // Venus Next: added to ALL Corporate Competition variants
    case 'Venuphile': return advanceTrackOf(Tag.VENUS);
    default:
      return false;
    }
  }

  public resolveTradeAction(cardName: string): void {
    const marsBot = this.marsBotManager;
    if (marsBot === undefined) {
      this.game.log(`MarsBot ${cardName}: no MarsBot manager available`);
      return;
    }

    const colony = selectTradeColony(this.game, marsBot);
    if (colony === undefined) {
      // A bonus card that can't resolve is not a Failed Action (rulebook A, p.5)
      this.game.log(`MarsBot ${cardName}: no tradeable colony, no effect (C-17)`);
      return;
    }
    // It must lose 1 MC to trade. With none, the card does nothing (Nick, BGG 3599965).
    if (marsBot.turnResolver.megacredits < 1) {
      this.game.log(`MarsBot ${cardName}: no MC to pay for the trade, no effect (C-17)`);
      return;
    }

    tradeWithColony(marsBot, colony);
    this.game.log(`MarsBot resolves ${cardName} (C-17)`);
  }

  public drawAndResolveAnotherBonus(): void {
    const nextBonus = this.bonusDeck.draw(this.game);
    if (nextBonus !== undefined) {
      this.game.log('MarsBot draws another bonus card: ${0}', (b) => b.rawString(bonusCardDisplayName(nextBonus)));
      this.resolve(nextBonus);
    }
    // Both cards are discarded (original was already discarded by caller)
  }

  /**
   * Advance the global parameter furthest from completion, measured in steps remaining
   * (a temperature step is 2 degrees). Tie: oxygen > ocean > temperature.
   *
   * Returns false when every parameter is already complete.
   */
  public advanceFurthestParameter(allowCorpIntercept: boolean = true): boolean {
    const tempRemaining = (this.game.max.temperature - this.game.getTemperature()) / 2;
    const oxyRemaining = this.game.max.oxygen - this.game.getOxygenLevel();
    const oceanRemaining = this.game.max.oceans - this.game.board.getOceanSpaces().length;

    const params: Array<{name: string, remaining: number, action: () => boolean}> = [
      {name: 'oxygen', remaining: oxyRemaining, action: () => {
        if (this.game.getOxygenLevel() < this.game.max.oxygen) {
          if (allowCorpIntercept && this.interceptsRaise(GlobalParameter.OXYGEN)) {
            return true;
          }
          this.game.increaseOxygenLevel(this.botPlayer, 1);
          return true;
        }
        return false;
      }},
      {name: 'ocean', remaining: oceanRemaining, action: () => {
        if (this.game.canAddOcean()) {
          const space = this.tilePlacer.findOceanSpace();
          if (space) {
            if (allowCorpIntercept && this.interceptsRaise(GlobalParameter.OCEANS)) {
              return true;
            }
            this.game.addOcean(this.botPlayer, space);
            this.turnResolver.gainMc(this.tilePlacer.getPlacementBonusMC(space) + this.tilePlacer.getOceanAdjacencyMC(space));
            return true;
          }
        }
        return false;
      }},
      {name: 'temperature', remaining: tempRemaining, action: () => {
        if (this.game.getTemperature() < this.game.max.temperature) {
          if (allowCorpIntercept && this.interceptsRaise(GlobalParameter.TEMPERATURE)) {
            return true;
          }
          this.game.increaseTemperature(this.botPlayer, 1);
          return true;
        }
        return false;
      }},
    ];

    // Most steps remaining first, tie order preserved (oxy > ocean > temp). Furthest from
    // completion counts steps, not the fraction done.
    params.sort((a, b) => b.remaining - a.remaining);

    for (const p of params) {
      if (p.action()) {
        this.game.log('MarsBot advances ${0} (furthest from completion)', (b) => b.rawString(p.name));
        return true;
      }
    }
    return false;
  }

  /** Takes up to `amount` M€ from MarsBot and returns how much it lost. */
  public loseMc(amount: number): number {
    const lost = Math.min(amount, this.turnResolver.megacredits);
    this.turnResolver.megacredits -= lost;
    return lost;
  }
}

/** The VP one resource on `card` is worth, or 0 when the card doesn't score its resources (Vermin included). */
function vpPerResource(card: ICard): number {
  const vp = card.victoryPoints;
  if (typeof vp === 'object' && vp.resourcesHere !== undefined) {
    return (vp.each ?? 1) / (vp.per ?? 1);
  }
  return 0;
}
