import {expect} from 'chai';
import {setOxygenLevel, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {BonusCardId, getAutomaMaxGeneration} from '../../../src/common/automa/AutomaTypes';
import {Phase} from '../../../src/common/Phase';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MAX_VENUS_SCALE} from '../../../src/common/constants';
import {CardName} from '../../../src/common/cards/CardName';
import {testGame} from '../../TestGame';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {createCorpBonusCard} from '../../../src/server/automa/MarsBotBonusCard';
import {Tag} from '../../../src/common/cards/Tag';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {TileType} from '../../../src/common/TileType';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {BoardName} from '../../../src/common/boards/BoardName';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {Birds} from '../../../src/server/cards/base/Birds';
import {MarsUniversity} from '../../../src/server/cards/base/MarsUniversity';
import {Asteroid} from '../../../src/server/cards/base/Asteroid';
import {AICentral} from '../../../src/server/cards/base/AICentral';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {SearchForLife} from '../../../src/server/cards/base/SearchForLife';
import {BribedCommittee} from '../../../src/server/cards/base/BribedCommittee';
import {
  clearMarsBotCorpRegistry, restoreMarsBotCorpRegistry,
  getMarsBotCorp,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
  });
  expect(game.automaHooks?.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

function fakeCard(name: string, opts: {tags?: Array<Tag>, cost?: number, requirements?: boolean, victoryPoints?: number} = {}): IProjectCard {
  return {
    name: name as CardName,
    tags: opts.tags ?? [],
    cost: opts.cost ?? 0,
    requirements: opts.requirements ? [{oceans: 1}] : [],
    getVictoryPoints: () => opts.victoryPoints ?? 0,
  } as unknown as IProjectCard;
}

describe('Corp Effect Hooks', () => {
  beforeEach(() => {
    clearMarsBotCorpRegistry();
    restoreMarsBotCorpRegistry();
  });

  afterEach(() => {
    restoreMarsBotCorpRegistry();
  });

  describe('C05 Inventrix hasRequirements', () => {
    it('gains 2 M€ for cards with requirements', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.INVENTRIX)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('Req', {cost: 10, requirements: true}));
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 2);
    });

    it('does NOT gain M€ for cards without requirements', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.INVENTRIX)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('NoReq', {cost: 10}));
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore);
    });
  });

  describe('C17 Vitor VP check', () => {
    function vitorGain(card: IProjectCard): number {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.VITOR)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onProjectCardResolved!(marsBot, card);
      return marsBot.turnResolver.megacredits - mcBefore;
    }

    it('gains 3 M€ for a card with printed VP', () => {
      expect(vitorGain(new AICentral())).to.eq(3);
    });

    it('gains 3 M€ for a card with variable VP that scores nothing yet', () => {
      expect(vitorGain(new Tardigrades())).to.eq(3);
      expect(vitorGain(new SearchForLife())).to.eq(3);
    });

    it('does NOT gain M€ for cards without VP', () => {
      expect(vitorGain(new Asteroid())).to.eq(0);
    });

    it('does NOT gain M€ for negative VP cards', () => {
      expect(vitorGain(new BribedCommittee())).to.eq(0);
    });
  });

  describe('C25 Viron floater + VP', () => {
    it('gains a floater and counts the card only for active cards with an action', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.VIRON)!;
      marsBot.setCorpAndSetup(corp);
      corp.effect!.onProjectCardResolved!(marsBot, new Birds());
      expect(marsBot.floaters).to.eq(1);
      expect(marsBot.corpSpecificState.get('actionCardsPlayed')).to.eq(1);

      // An active card with only an effect, and an event, count for nothing
      corp.effect!.onProjectCardResolved!(marsBot, new MarsUniversity());
      corp.effect!.onProjectCardResolved!(marsBot, new Asteroid());
      expect(marsBot.floaters).to.eq(1);
      expect(marsBot.corpSpecificState.get('actionCardsPlayed')).to.eq(1);
    });

    it('vpBonus returns action card count', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.VIRON)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('actionCardsPlayed', 5);
      expect(corp.effect!.vpBonus!(marsBot)).to.eq(5);
    });
  });

  describe('C28 Aphrodite onVenusRaised', () => {
    it('gains 2 M€ for every step Venus is raised', () => {
      const [game, human] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.APHRODITE)!);
      const mc = marsBot.turnResolver.megacredits;

      game.increaseVenusScaleLevel(human, 2);
      expect(marsBot.turnResolver.megacredits).to.eq(mc + 4);

      game.increaseVenusScaleLevel(marsBot.player, 1);
      expect(marsBot.turnResolver.megacredits).to.eq(mc + 6);
    });

    it('gains nothing once Venus is maxed', () => {
      const [game, human] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.APHRODITE)!);
      setVenusScaleLevel(game, MAX_VENUS_SCALE);
      const mc = marsBot.turnResolver.megacredits;

      game.increaseVenusScaleLevel(human, 2);

      expect(marsBot.turnResolver.megacredits).to.eq(mc);
    });
  });

  describe('C10 Tharsis Republic onTilePlaced', () => {
    it('gains 2 M€ when any city placed', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.THARSIS_REPUBLIC)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onTilePlaced!(marsBot, false, TileType.CITY, marsBot.game.board.spaces[0]);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 2);
    });

    it('advances event track when MarsBot places city, without the 2 M€', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.THARSIS_REPUBLIC)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.turnResolver.advanceTrack = (i) => {
        marsBot.marsBotBoard.tracks[i].position++;
        return true;
      };
      const mcBefore = marsBot.turnResolver.megacredits;
      const eventBefore = marsBot.marsBotBoard.tracks[2].position;
      corp.effect!.onTilePlaced!(marsBot, true, TileType.CITY, marsBot.game.board.spaces[0]);
      expect(marsBot.marsBotBoard.tracks[2].position).to.eq(eventBefore + 1);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore);
    });

    it('does not trigger on greenery placement', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.THARSIS_REPUBLIC)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onTilePlaced!(marsBot, false, TileType.GREENERY, marsBot.game.board.spaces[0]);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore);
    });
  });

  describe('C35 Lakefront Resorts onTilePlaced', () => {
    it('ocean placed with white cube → remove cube, advance building track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
      const buildingBefore = marsBot.marsBotBoard.tracks[0].position;
      corp.effect!.onTilePlaced!(marsBot, false, TileType.OCEAN, marsBot.game.board.spaces[0]);
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
      expect(marsBot.marsBotBoard.tracks[0].position).to.be.gte(buildingBefore + 1);
    });

    it('pays 3 M€ per adjacent ocean when MarsBot places a tile', () => {
      const {game, marsBot} = createAutomaGame();
      const ocean = game.board.getAvailableSpacesForOcean(marsBot.player)[0];
      const land = game.board.getAdjacentSpaces(ocean).find((s) => s.spaceType === SpaceType.LAND)!;
      game.simpleAddTile(marsBot.player, ocean, {tileType: TileType.OCEAN});
      const tilePlacer = marsBot['bonusResolver']['tilePlacer'];
      expect(tilePlacer.getOceanAdjacencyMC(land)).to.eq(2);
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!);
      expect(tilePlacer.getOceanAdjacencyMC(land)).to.eq(3);
    });

    // FAQ (rulebook B, p.3): Lakefront overrides Government Intervention's "no M€", but not its "no TR"
    it('keeps the M€ but not the TR from its advance during Government Intervention', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!);
      setTemperature(game, MAX_TEMPERATURE);
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      game.generation = 2;
      marsBot.advanceTrack = () => {
        marsBot.gainMc(4);
        marsBot.raiseTR(1);
      };
      const mcBefore = marsBot.megacredits;
      const trBefore = marsBot.player.terraformRating;

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

      expect(game.board.getOceanSpaces()).has.length(1);
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
      expect(marsBot.megacredits).to.eq(mcBefore + 4);
      expect(marsBot.player.terraformRating).to.eq(trBefore);
    });

    it('ocean placed without white cube → place white cube', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
      corp.effect!.onTilePlaced!(marsBot, false, TileType.OCEAN, marsBot.game.board.spaces[0]);
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
    });
  });

  describe('C36 Pristar interceptGlobalParameterRaise', () => {
    it('intercepts parameter raise when white cube on card', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PRISTAR)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
      const trBefore = marsBot.player.terraformRating;
      const mcBefore = marsBot.turnResolver.megacredits;
      const skip = corp.effect!.interceptGlobalParameterRaise!(marsBot, GlobalParameter.TEMPERATURE);
      expect(skip).to.be.true;
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
      expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 6);
    });

    it('does not intercept without white cube', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PRISTAR)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
      const skip = corp.effect!.interceptGlobalParameterRaise!(marsBot, GlobalParameter.TEMPERATURE);
      expect(skip).to.be.false;
    });

    it('per-gen adds white cube when missing', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PRISTAR)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
      corp.beforeActionPhase!(marsBot);
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
    });
  });

  describe('C32 Polyphemos discard fewest tags', () => {
    it('discards card with fewest tags from action deck', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
      marsBot.setCorpAndSetup(corp);
      const deckBefore = marsBot.actionDeck.length;
      corp.beforeActionPhase!(marsBot);
      expect(marsBot.actionDeck.length).to.eq(deckBefore - 1);
    });
  });

  describe('C31 Arklight', () => {
    /** M€ Arklight's effect adds when MarsBot resolves `card`, against the same game without the effect. */
    function arklightGain(card: IProjectCard): number {
      const corp = getMarsBotCorp(CardName.ARKLIGHT)!;
      const run = (c: typeof corp) => {
        const {marsBot} = createAutomaGame();
        marsBot.setCorpAndSetup(c);
        const mcBefore = marsBot.turnResolver.megacredits;
        marsBot.turnResolver.resolveProjectCard(card);
        return marsBot.turnResolver.megacredits - mcBefore;
      };
      return run(corp) - run({...corp, effect: undefined});
    }

    it('earns 2 M€ per plant or animal tag, not per card', () => {
      expect(arklightGain(fakeCard('PlantAnimal', {tags: [Tag.PLANT, Tag.ANIMAL]}))).to.eq(4);
    });

    it('earns nothing for a microbe tag', () => {
      expect(arklightGain(fakeCard('Microbe', {tags: [Tag.MICROBE]}))).to.eq(0);
    });
  });

  describe('C06 Mining Guild card countdown', () => {
    it('card starts at 10, and the M€ its starting tags earn count down from it', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.MINING_GUILD)!;
      const mcBefore = marsBot.turnResolver.megacredits;
      marsBot.setCorpAndSetup(corp);
      const earned = marsBot.turnResolver.megacredits - mcBefore;
      expect(earned).is.greaterThan(0);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(10 - earned);
    });

    it('earning M€ counts down the card, bot keeps the earnings', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.MINING_GUILD)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('mcOnCard', 10);
      // 5 MC earned: card counts down 10 → 5
      corp.effect!.onMcGained!(marsBot, 5);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(5);
    });

    // Our reading: the card ticks for every 10 M€ MarsBot gains (njshaw2, BGG 3553988), so what
    // is left of a gain after the card empties comes off the refilled card.
    function miningGuild(mcOnCard: number, building: number) {
      const {marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MINING_GUILD)!);
      marsBot.corpSpecificState.set('mcOnCard', mcOnCard);
      marsBot.marsBotBoard.tracks[0].position = building;
      return marsBot;
    }

    it('when card empties, refill, advance building track, and take the rest off the refilled card', () => {
      // Tharsis building #3 has no icon
      const marsBot = miningGuild(2, 2);
      marsBot.turnResolver.gainMc(5);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(7);
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(3);
    });

    it('a gain that empties the card several times advances once per emptying', () => {
      // Tharsis building #3 and #4 have no icon, #5 gives TR
      const marsBot = miningGuild(2, 2);
      marsBot.turnResolver.gainMc(25);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(7);
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(5);
    });

    it('stops once the building track reaches #18', () => {
      const marsBot = miningGuild(2, 17);
      marsBot.turnResolver.gainMc(15);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(10);
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(18);
    });

    // Our reading, like Philares (TDaver, BGG 3513998): nothing advances after the game has ended
    it('stops counting down once the game has ended', () => {
      const marsBot = miningGuild(2, 2);
      marsBot.game.generation = getAutomaMaxGeneration(marsBot.game.gameOptions.preludeExtension);
      marsBot.game.phase = Phase.PRODUCTION;
      expect(marsBot.game.isDoneWithFinalProduction()).is.true;
      const mc = marsBot.turnResolver.megacredits;

      marsBot.turnResolver.gainMc(5);

      expect(marsBot.turnResolver.megacredits).to.eq(mc + 5);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(2);
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(2);
    });

    it('takes the M€ the building track advance earns off the refilled card', () => {
      // Tharsis building #2 places an ocean, which pays M€
      const marsBot = miningGuild(1, 1);
      const mc = marsBot.turnResolver.megacredits;
      marsBot.turnResolver.gainMc(1);
      const earnedByAdvance = marsBot.turnResolver.megacredits - mc - 1;
      expect(earnedByAdvance).is.greaterThan(0);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(10 - earnedByAdvance);
    });
  });

  describe('corp hook wiring', () => {
    it('Mining Guild counts down through turnResolver.gainMc', () => {
      const {marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MINING_GUILD)!);
      marsBot.corpSpecificState.set('mcOnCard', 10);
      const mcBefore = marsBot.turnResolver.megacredits;
      marsBot.turnResolver.gainMc(4);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 4);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(6);
    });

    it('Pristar cube intercepts the bot ocean placement', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
      const oceansBefore = game.board.getOceanSpaces().length;
      const trBefore = marsBot.player.terraformRating;
      const mcBefore = marsBot.turnResolver.megacredits;
      marsBot.turnResolver.placeOcean();
      expect(game.board.getOceanSpaces().length).to.eq(oceansBefore);
      expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 6);
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
    });

    it('Pristar without a cube lets the raise through', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
      const oceansBefore = game.board.getOceanSpaces().length;
      marsBot.turnResolver.placeOcean();
      expect(game.board.getOceanSpaces().length).to.eq(oceansBefore + 1);
    });

    it('Government Intervention does not trigger Pristar (FAQ)', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
      (game as any).generation = 2; // even generation → furthest-parameter branch
      (marsBot as any).bonusResolver.resolveGovernmentIntervention();
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
    });
  });

  // A 2-step raise resolves one step at a time, so Pristar's cube cancels only the first step
  // (BGG threads 3431297 and 3432237, TDaver)
  describe('C36 Pristar on a 2-step raise', () => {
    function pristarGame(venus: boolean = false) {
      const [game] = testGame(1, {automaOption: true, venusNextExtension: venus, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
      return {game, marsBot, tr: marsBot.player.terraformRating, mc: marsBot.turnResolver.megacredits};
    }

    it('temperature2 icon raises the second step', () => {
      const {game, marsBot, tr, mc} = pristarGame();
      setTemperature(game, -30);
      marsBot.turnResolver.raiseTemperature(2);
      expect(game.getTemperature()).to.eq(-28);
      expect(marsBot.player.terraformRating).to.eq(tr + 2);
      expect(marsBot.turnResolver.megacredits).to.eq(mc + 6);
      expect(marsBot.temperatureRaises).to.eq(1);
    });

    it('venus2 icon raises the second step', () => {
      const {game, marsBot, tr} = pristarGame(true);
      (marsBot.turnResolver as any).raiseVenus(2);
      expect(game.getVenusScaleLevel()).to.eq(2);
      expect(marsBot.player.terraformRating).to.eq(tr + 2);
    });

    it('Lobbyists temperature branch raises the second step', () => {
      const {game, marsBot, tr} = pristarGame();
      setTemperature(game, -28);
      marsBot.resolveBonusCard(BonusCardId.B06_LOBBYISTS);
      expect(game.getTemperature()).to.eq(-26);
      expect(marsBot.player.terraformRating).to.eq(tr + 2);
    });

    it('Lobbyists (Venus) Venus branch raises the second step', () => {
      const {game, marsBot, tr} = pristarGame(true);
      setVenusScaleLevel(game, 4);
      marsBot.resolveBonusCard(BonusCardId.B15_LOBBYISTS_VENUS);
      expect(game.getVenusScaleLevel()).to.eq(6);
      expect(marsBot.player.terraformRating).to.eq(tr + 2);
    });
  });

  describe('starting tags resolve as a revealed card (rulebook B, setup step 4)', () => {
    /** Runs setup for `corp` as is and with its ongoing effect removed, in identical games. */
    function setupWithAndWithoutEffect(name: CardName) {
      const corp = getMarsBotCorp(name)!;
      const run = (c: typeof corp) => {
        const {marsBot} = createAutomaGame();
        marsBot.setCorpAndSetup(c);
        return {
          mc: marsBot.turnResolver.megacredits,
          tr: marsBot.player.terraformRating,
          events: marsBot.marsBotBoard.tracks[2].position,
        };
      };
      return {withEffect: run(corp), without: run({...corp, effect: undefined})};
    }

    it('Arclight earns 2 M€ for its Animal starting tag', () => {
      const {withEffect, without} = setupWithAndWithoutEffect(CardName.ARKLIGHT);
      expect(withEffect.mc).to.eq(without.mc + 2);
    });

    it('Pharmacy Union raises its TR for its Science starting tag', () => {
      const {withEffect, without} = setupWithAndWithoutEffect(CardName.PHARMACY_UNION);
      expect(withEffect.tr).to.eq(without.tr + 1);
    });

    it('Saturn Systems advances the event track for its Jovian starting tag', () => {
      const {withEffect, without} = setupWithAndWithoutEffect(CardName.SATURN_SYSTEMS);
      expect(withEffect.events).to.be.greaterThan(without.events);
    });

    it('the starting tags make one card, so a corp with several tags is not paid per tag', () => {
      const {withEffect, without} = setupWithAndWithoutEffect(CardName.SAGITTA_FRONTIER_SERVICES);
      expect(withEffect.mc).to.eq(without.mc);
    });

    it('a corp without starting tags gets no card resolved', () => {
      const {withEffect, without} = setupWithAndWithoutEffect(CardName.CREDICOR);
      expect(withEffect).to.deep.eq(without);
    });
  });

  describe('Ecoline/Ecotec plant targeting (FAQ)', () => {
    it('plant removal targets plantResources on corp card when present', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      // Ecotec starts with 2 plant resources and 1 more from its starting plant tag
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(3);
      const mcBefore = marsBot.turnResolver.megacredits;
      // Remove 4 plants — should take 3 from card, excess lost, NOT from MC supply
      marsBot.player.stock.add('plants' as any, -4);
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(0);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore); // No MC deducted
    });

    it('non-plant removal still deducts from MC supply', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.turnResolver.megacredits = 10;
      marsBot.player.stock.add('steel' as any, -3);
      expect(marsBot.turnResolver.megacredits).to.eq(7);
    });
  });

  describe('Serialization with corp state', () => {
    it('round-trips floaters', () => {
      const {marsBot} = createAutomaGame();
      marsBot.floaters = 7;
      const state = marsBot.serialize();
      const {marsBot: marsBot2} = createAutomaGame();
      marsBot2.restoreState(state);
      expect(marsBot2.floaters).to.eq(7);
    });

    it('round-trips corpSpecificState', () => {
      const {marsBot} = createAutomaGame();
      marsBot.corpSpecificState.set('test', 42);
      const state = marsBot.serialize();
      const {marsBot: marsBot2} = createAutomaGame();
      marsBot2.restoreState(state);
      expect(marsBot2.corpSpecificState.get('test')).to.eq(42);
    });
  });
});
