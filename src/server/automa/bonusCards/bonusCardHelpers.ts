/**
 * Shared helper functions for MarsBot bonus card definitions.
 */
import {CardResource} from '@/common/CardResource';
import {GlobalParameter} from '@/common/GlobalParameter';
import {CardName} from '@/common/cards/CardName';
import {IGame} from '@/server/IGame';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {pickByFlippedCard} from '@/server/automa/MarsBotCardFlip';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';
import {Board} from '@/server/boards/Board';
import {GlobalParameterTracks} from '@/server/boards/GlobalParameterTracks';
import {Space} from '@/server/boards/Space';
import {ICard} from '@/server/cards/ICard';
import {venusStepsBetween} from '@/server/venusNext/venusScale';

/**
 * Advances a track for a bonus card.
 *
 * A maxed track stays put: a bonus card that can't resolve takes no Failed Action (rulebook A p.5;
 * BGG 3599965, 3623553).
 */
export function maybeAdvanceTrack(marsBot: IMarsBot, trackIndex: number): void {
  if (!marsBot.marsBotBoard.tracks[trackIndex].canAdvance()) {
    marsBot.game.log('MarsBot: track ${0} at max, no effect', (b) => b.number(trackIndex + 1));
    return;
  }
  marsBot.advanceTrack(trackIndex);
}

/** Takes up to `amount` M€ from MarsBot and returns how much it lost. */
export function loseMc(marsBot: IMarsBot, amount: number): number {
  const lost = Math.min(amount, marsBot.megacredits);
  marsBot.megacredits -= lost;
  return lost;
}

/**
 * Removes the player's animal or microbe worth the most VP, for the bonus card `source`.
 *
 * False when no card has one MarsBot may remove. Cards that score their resources come first, then
 * the rest; a tie goes to a flipped project card (BGG 3360797).
 */
export function maybeRemoveAnimalOrMicrobe(marsBot: IMarsBot, source: CardName): boolean {
  const game = marsBot.game;
  const humanPlayer = marsBot.humanPlayer;
  // Protected Habitat blocks animal/microbe removal
  const isProtected = humanPlayer.playedCards.has(CardName.PROTECTED_HABITATS);

  // Pets and Bioengineering Enclosure protect their resources from opponents
  const candidates = isProtected ? [] : humanPlayer.playedCards.filter((played) =>
    (played.resourceCount ?? 0) > 0 && played.protectedResources !== true &&
    (played.resourceType === CardResource.ANIMAL || played.resourceType === CardResource.MICROBE));
  if (candidates.length > 0) {
    const best = Math.max(...candidates.map(vpPerResource));
    const tied = candidates.filter((played) => vpPerResource(played) === best);
    const card = tied.length > 1 ? pickByFlippedCard(game, tied) ?? tied[0] : tied[0];
    humanPlayer.removeResourceFrom(card, 1, {removingPlayer: marsBot.player, log: false});
    game.log('MarsBot (${0}): removed 1 ${1} from ${2}',
      (b) => b.cardName(source).rawString(card.resourceType ?? '').card(card));
    return true;
  }
  if (isProtected) {
    game.log('MarsBot (${0}): blocked by Protected Habitats', (b) => b.cardName(source));
  } else {
    game.log('MarsBot (${0}): no animal/microbe resources to remove', (b) => b.cardName(source));
  }
  return false;
}

/** The VP one resource on `card` is worth, or 0 when the card doesn't score its resources (Vermin included). */
function vpPerResource(card: ICard): number {
  const vp = card.victoryPoints;
  if (typeof vp === 'object' && vp.resourcesHere !== undefined) {
    return (vp.each ?? 1) / (vp.per ?? 1);
  }
  return 0;
}

/** Lobbyists branch (c): an ocean space next to 2+ oceans takes an ocean. */
export function lobbyistsOceanBranch(marsBot: IMarsBot, source: string = 'Lobbyists'): boolean {
  const game = marsBot.game;
  if (!game.canAddOcean()) {
    return false;
  }
  const tilePlacer = new MarsBotTilePlacer(marsBot);
  const space = tilePlacer.findOceanSpace((s) =>
    game.board.getAdjacentSpaces(s).filter((a) => Board.isOceanSpace(a) && a.tile !== undefined).length >= 2);
  if (space === undefined) {
    return false;
  }
  if (marsBot.interceptsParameterRaise(GlobalParameter.OCEANS)) {
    game.log(`MarsBot skips the ocean (${source})`);
    return true;
  }
  game.addOcean(marsBot.player, space);
  marsBot.gainMc(tilePlacer.getTotalPlacementMC(space));
  game.log(`MarsBot places ocean (${source})`);
  return true;
}

/** Checks whether the `type` parameter is 1 or 2 steps from the nearer of its next bonus step and its maximum. */
export function isNearBonusStep(game: IGame, type: keyof GlobalParameterTracks): boolean {
  const steps = stepsToNextBonus(game, type);
  return steps >= 1 && steps <= 2;
}

/**
 * Counts the steps from the current level of the `type` parameter to the nearer of the next bonus step
 * printed on the map's track and the track's maximum.
 *
 * A temperature step is 2 degrees, an oxygen step 1%, and a Venus step 2% up to 30%, then 1%.
 * Returns 0 when the track is at its maximum.
 */
function stepsToNextBonus(game: IGame, type: keyof GlobalParameterTracks): number {
  const nextStop = (level: number) => Math.min(
    game.max[type],
    ...game.globalParameterTracks[type].map((threshold) => threshold.value).filter((value) => value > level));
  switch (type) {
  case 'temperature': {
    const level = game.getTemperature();
    return (nextStop(level) - level) / 2;
  }
  case 'oxygen': {
    const level = game.getOxygenLevel();
    return nextStop(level) - level;
  }
  case 'venus': {
    const level = game.getVenusScaleLevel();
    return venusStepsBetween(level, nextStop(level));
  }
  }
}

/** Lobbyists shared branch (a): temperature 1-2 steps from bonus or completion. */
export function lobbyistsTempBranch(marsBot: IMarsBot, source: string = 'Lobbyists'): boolean {
  const game = marsBot.game;
  if (isNearBonusStep(game, 'temperature')) {
    // Pristar's cube cancels only the first of the 2 steps
    const steps = marsBot.interceptsParameterRaise(GlobalParameter.TEMPERATURE) ? 1 : 2;
    game.increaseTemperature(marsBot.player, steps);
    game.log(`MarsBot raises temperature ${steps} step(s) (${source})`);
    return true;
  }
  return false;
}

/** Lobbyists shared branch (b): oxygen 1-2 steps from bonus or completion. */
export function lobbyistsOxygenBranch(marsBot: IMarsBot, source: string = 'Lobbyists'): boolean {
  const game = marsBot.game;
  if (isNearBonusStep(game, 'oxygen')) {
    const tilePlacer = new MarsBotTilePlacer(marsBot);
    const greenerySpace = tilePlacer.findGreenerySpace();
    if (greenerySpace !== undefined) {
      const raiseOxygen = game.getOxygenLevel() >= game.max.oxygen ||
        !marsBot.interceptsParameterRaise(GlobalParameter.OXYGEN);
      game.addGreenery(marsBot.player, greenerySpace, raiseOxygen);
      marsBot.gainMc(tilePlacer.getPlacementBonusMC(greenerySpace) + tilePlacer.getOceanAdjacencyMC(greenerySpace));
      if (game.getOxygenLevel() < game.max.oxygen && !marsBot.interceptsParameterRaise(GlobalParameter.OXYGEN)) {
        game.increaseOxygenLevel(marsBot.player, 1);
      }
      game.log(`MarsBot places greenery and raises oxygen twice (${source})`);
      return true;
    }
  }
  return false;
}

/**
 * Places a MarsBot greenery on a space that passes `filter` and raises oxygen.
 *
 * Returns false, with no Failed Action, when no such space is left.
 */
export function maybePlaceGreenery(marsBot: IMarsBot, filter?: (space: Space) => boolean): boolean {
  const game = marsBot.game;
  const tilePlacer = new MarsBotTilePlacer(marsBot);
  const space = tilePlacer.findGreenerySpace(filter);
  if (space === undefined) {
    return false;
  }
  const raiseOxygen = game.getOxygenLevel() >= game.max.oxygen ||
    !marsBot.interceptsParameterRaise(GlobalParameter.OXYGEN);
  game.addGreenery(marsBot.player, space, raiseOxygen);
  marsBot.gainMc(tilePlacer.getTotalPlacementMC(space));
  return true;
}

/** Execute an action and reverse any TR gained (for Government Intervention). */
export function withoutTRGain(marsBot: IMarsBot, action: () => void): void {
  const trBefore = marsBot.player.terraformRating;
  action();
  const trGained = marsBot.player.terraformRating - trBefore;
  if (trGained > 0) {
    marsBot.player.decreaseTerraformRating(trGained);
    marsBot.game.log('MarsBot does not receive TR from Government Intervention');
  }
}

/**
 * Runs `action` and caps MarsBot's M€ supply at what it was before, so the action pays MarsBot no
 * M€ (for Government Intervention). A supply the action lowers stays lowered.
 *
 * M€ that Lakefront Resorts' advance brings in stays (rulebook B, p.4).
 */
export function withoutMcGain(marsBot: IMarsBot, action: () => void): void {
  const mcBefore = marsBot.megacredits;
  marsBot.mcKeptThroughIntervention = 0;
  let kept = 0;
  try {
    action();
  } finally {
    kept = marsBot.mcKeptThroughIntervention ?? 0;
    marsBot.mcKeptThroughIntervention = undefined;
  }
  if (marsBot.megacredits > mcBefore + kept) {
    marsBot.megacredits = mcBefore + kept;
    marsBot.game.log('MarsBot does not receive M€ from Government Intervention');
  }
}

/**
 * Execute an action and reverse any TR or M€ gained (for Government Intervention).
 *
 * M€ that Lakefront Resorts' advance brings in stays (rulebook B, p.4).
 */
export function withoutTRorMcGain(marsBot: IMarsBot, action: () => void): void {
  withoutMcGain(marsBot, () => withoutTRGain(marsBot, action));
}

/**
 * Advance the global parameter furthest from completion, measured in steps remaining
 * (a temperature step is 2 degrees). Tie: oxygen > ocean > temperature.
 *
 * Returns false when every parameter is already complete.
 */
export function advanceFurthestParameter(marsBot: IMarsBot, allowCorpIntercept: boolean = true): boolean {
  const game = marsBot.game;
  const tempRemaining = (game.max.temperature - game.getTemperature()) / 2;
  const oxyRemaining = game.max.oxygen - game.getOxygenLevel();
  const oceanRemaining = game.max.oceans - game.board.getOceanSpaces().length;

  const params: Array<{name: string, remaining: number, action: () => boolean}> = [
    {name: 'oxygen', remaining: oxyRemaining, action: () => {
      if (game.getOxygenLevel() < game.max.oxygen) {
        if (allowCorpIntercept && marsBot.interceptsParameterRaise(GlobalParameter.OXYGEN)) {
          return true;
        }
        game.increaseOxygenLevel(marsBot.player, 1);
        return true;
      }
      return false;
    }},
    {name: 'ocean', remaining: oceanRemaining, action: () => {
      if (game.canAddOcean()) {
        const tilePlacer = new MarsBotTilePlacer(marsBot);
        const space = tilePlacer.findOceanSpace();
        if (space) {
          if (allowCorpIntercept && marsBot.interceptsParameterRaise(GlobalParameter.OCEANS)) {
            return true;
          }
          game.addOcean(marsBot.player, space);
          marsBot.gainMc(tilePlacer.getPlacementBonusMC(space) + tilePlacer.getOceanAdjacencyMC(space));
          return true;
        }
      }
      return false;
    }},
    {name: 'temperature', remaining: tempRemaining, action: () => {
      if (game.getTemperature() < game.max.temperature) {
        if (allowCorpIntercept && marsBot.interceptsParameterRaise(GlobalParameter.TEMPERATURE)) {
          return true;
        }
        game.increaseTemperature(marsBot.player, 1);
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
      game.log('MarsBot advances ${0} (furthest from completion)', (b) => b.rawString(p.name));
      return true;
    }
  }
  return false;
}
