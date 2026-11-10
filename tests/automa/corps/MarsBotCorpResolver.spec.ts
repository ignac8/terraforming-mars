import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {createBonusCard} from '../../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {MarsBotCorpResolver} from '../../../src/server/automa/corps/MarsBotCorpResolver';
import {IMarsBotCorp} from '../../../src/server/automa/IMarsBotCorp';
import {MarsBotTrackCube} from '../../../src/server/automa/MarsBotCorpTypes';
import {
  registerMarsBotCorp,
  clearMarsBotCorpRegistry, restoreMarsBotCorpRegistry,
  getAllMarsBotCorps, getMarsBotCorp,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';
import {Tag} from '../../../src/common/cards/Tag';
import {CardName} from '../../../src/common/cards/CardName';
import {SeededRandom} from '../../../src/common/utils/Random';
import {BoardName} from '../../../src/common/boards/BoardName';
import {DEFAULT_GAME_OPTIONS} from '../../../src/server/game/GameOptions';

function createTestCorp(overrides: Partial<IMarsBotCorp> & {name: CardName}): IMarsBotCorp {
  return {
    description: '',
    tags: [],
    ...overrides,
  };
}

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automa: true,
    automaDifficulty: difficulty,
    boardName: BoardName.THARSIS,
  });
  expect(game.automaHooks?.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

describe('MarsBotCorpResolver', () => {
  beforeEach(() => {
    clearMarsBotCorpRegistry();
  });

  afterEach(() => {
    restoreMarsBotCorpRegistry();
  });

  describe('selectCorp', () => {
    it('throws with empty registry', () => {
      const rng = new SeededRandom(42);
      expect(() => MarsBotCorpResolver.selectCorp(CardName.ECOLINE, DEFAULT_GAME_OPTIONS, rng)).to.throw('No MarsBot corps registered');
    });

    it('selects a corp from registry', () => {
      const corpA = createTestCorp({name: CardName.ECOLINE});
      registerMarsBotCorp(corpA);

      const rng = new SeededRandom(42);
      const result = MarsBotCorpResolver.selectCorp(CardName.CREDICOR, DEFAULT_GAME_OPTIONS, rng);
      expect(result).to.not.be.undefined;
      expect(result!.name).to.eq(CardName.ECOLINE);
    });

    it('excludes corp matching human corp name', () => {
      const corpA = createTestCorp({name: CardName.ECOLINE});
      const corpB = createTestCorp({name: CardName.HELION});
      registerMarsBotCorp(corpA);
      registerMarsBotCorp(corpB);

      const rng = new SeededRandom(42);
      // Human has EcoLine, so MarsBot should get Other Corp
      const result = MarsBotCorpResolver.selectCorp(CardName.ECOLINE, DEFAULT_GAME_OPTIONS, rng);
      expect(result).to.not.be.undefined;
      expect(result!.name).to.eq(CardName.HELION);
    });

    it('skips a corp whose expansion is not in play', () => {
      registerMarsBotCorp(createTestCorp({name: CardName.ECOLINE}));
      registerMarsBotCorp(createTestCorp({name: CardName.APHRODITE, requiredExpansions: ['venus']}));
      const lastCorp = {next: () => 0.99, nextInt: (n: number) => n - 1} as any;

      expect(MarsBotCorpResolver.selectCorp(CardName.CREDICOR, DEFAULT_GAME_OPTIONS, lastCorp).name).to.eq(CardName.ECOLINE);
    });

    it('draws a corp when any one of its expansions is in play', () => {
      registerMarsBotCorp(createTestCorp({name: CardName.ECOLINE}));
      registerMarsBotCorp(createTestCorp({name: CardName.CELESTIC, requiredExpansions: ['venus', 'colonies']}));
      const lastCorp = {next: () => 0.99, nextInt: (n: number) => n - 1} as any;
      const withColonies = {...DEFAULT_GAME_OPTIONS, expansions: {...DEFAULT_GAME_OPTIONS.expansions, colonies: true}};

      expect(MarsBotCorpResolver.selectCorp(CardName.CREDICOR, withColonies, lastCorp).name).to.eq(CardName.CELESTIC);
    });

    it('throws when only corp matches human', () => {
      const corpA = createTestCorp({name: CardName.ECOLINE});
      registerMarsBotCorp(corpA);

      const rng = new SeededRandom(42);
      expect(() => MarsBotCorpResolver.selectCorp(CardName.ECOLINE, DEFAULT_GAME_OPTIONS, rng)).to.throw('No MarsBot corps registered');
    });
  });

  describe('setupCorp', () => {
    it('resolves starting tags by advancing tracks', () => {
      const {marsBot} = createAutomaGame();

      const corp = createTestCorp({
        name: CardName.ECOLINE,
        tags: [Tag.BUILDING, Tag.BUILDING], // Track 1 should advance twice
      });

      const track1Before = marsBot.marsBotBoard.tracks[0].position;
      MarsBotCorpResolver.setupCorp(corp, marsBot);
      const track1After = marsBot.marsBotBoard.tracks[0].position;

      // Track 1 handles Building tag, so should advance at least 2 (may chain)
      expect(track1After).to.be.gte(track1Before + 2);
    });

    it('places cubes on correct track positions', () => {
      const {marsBot} = createAutomaGame();

      const cubes: MarsBotTrackCube[] = [
        {trackIndex: 0, position: 5, cubeType: 'white'},
        {trackIndex: 2, position: 10, cubeType: 'black'},
      ];

      const corp = createTestCorp({
        name: CardName.ECOLINE,
        trackCubes: cubes,
      });

      MarsBotCorpResolver.setupCorp(corp, marsBot);

      expect(marsBot.trackCubePositions.size).to.eq(2);
      expect(marsBot.hasCubeAt(0, 5)).to.not.be.undefined;
      expect(marsBot.hasCubeAt(0, 5)!.cubeType).to.eq('white');
      expect(marsBot.hasCubeAt(2, 10)).to.not.be.undefined;
      expect(marsBot.hasCubeAt(2, 10)!.cubeType).to.eq('black');
    });

    it('calls corp setup resolve', () => {
      const {marsBot} = createAutomaGame();
      let setupCalled = false;

      const corp = createTestCorp({
        name: CardName.ECOLINE,
        setup: () => {
          setupCalled = true;
        },
      });

      MarsBotCorpResolver.setupCorp(corp, marsBot);
      expect(setupCalled).to.be.true;
    });
  });

  describe('onTrackAdvanced', () => {
    it('triggers cube effect when advancing to cube position', () => {
      const {marsBot} = createAutomaGame();
      let triggered = false;
      let triggeredTrackNum = 0;
      let triggeredPosition = 0;

      const corp = createTestCorp({
        name: CardName.ECOLINE,
        trackCubes: [{trackIndex: 1, position: 3, cubeType: 'white'}],
        effect: {
          onTrackCubeTrigger: (_ctx, trackIndex, position, _cubeType) => {
            triggered = true;
            triggeredTrackNum = trackIndex;
            triggeredPosition = position;
          },
        },
      });

      // Setup corp (places cubes)
      marsBot.corp = corp;
      marsBot.trackCubePositions.set('1:3', {trackIndex: 1, position: 3, cubeType: 'white'});

      // Simulate advancing to position 3
      MarsBotCorpResolver.onTrackAdvanced(marsBot, 1, 3);

      expect(triggered).to.be.true;
      expect(triggeredTrackNum).to.eq(1);
      expect(triggeredPosition).to.eq(3);
    });

    it('reports whether the cube replaced the printed icon', () => {
      const {marsBot} = createAutomaGame();
      const corp = createTestCorp({
        name: CardName.ECOLINE,
        trackCubes: [
          {trackIndex: 1, position: 3, cubeType: 'white'},
          {trackIndex: 1, position: 4, cubeType: 'black'},
        ],
        effect: {
          onTrackCubeTrigger: (_ctx, _trackIndex, _position, cubeType) => cubeType === 'white',
        },
      });
      marsBot.corp = corp;
      marsBot.trackCubePositions.set('1:3', {trackIndex: 1, position: 3, cubeType: 'white'});
      marsBot.trackCubePositions.set('1:4', {trackIndex: 1, position: 4, cubeType: 'black'});

      expect(MarsBotCorpResolver.onTrackAdvanced(marsBot, 1, 3)).to.be.true;
      expect(MarsBotCorpResolver.onTrackAdvanced(marsBot, 1, 4)).to.be.false;
      expect(MarsBotCorpResolver.onTrackAdvanced(marsBot, 1, 5)).to.be.false;
    });

    it('does not re-trigger already triggered cubes', () => {
      const {marsBot} = createAutomaGame();
      let triggerCount = 0;

      const corp = createTestCorp({
        name: CardName.ECOLINE,
        trackCubes: [{trackIndex: 1, position: 3, cubeType: 'white'}],
        effect: {
          onTrackCubeTrigger: () => {
            triggerCount++;
          },
        },
      });

      marsBot.corp = corp;
      marsBot.trackCubePositions.set('1:3', {trackIndex: 1, position: 3, cubeType: 'white'});

      MarsBotCorpResolver.onTrackAdvanced(marsBot, 1, 3);
      expect(triggerCount).to.eq(1);

      // Try to trigger again (e.g., after regression and re-advance)
      MarsBotCorpResolver.onTrackAdvanced(marsBot, 1, 3);
      expect(triggerCount).to.eq(1); // Should not re-trigger
    });

    it('hands the corp only its own cubes, not the rule cubes on the tracks', () => {
      const {marsBot} = createAutomaGame();
      let triggerCount = 0;
      marsBot.corp = createTestCorp({
        name: CardName.ECOLINE,
        trackCubes: [{trackIndex: 1, position: 3, cubeType: 'white'}],
        effect: {
          onTrackCubeTrigger: () => {
            triggerCount++;
          },
        },
      });
      marsBot.trackCubePositions.set('1:3', {trackIndex: 1, position: 3, cubeType: 'white'});
      marsBot.trackCubePositions.set('2:9', {trackIndex: 2, position: 9, cubeType: 'white'});

      MarsBotCorpResolver.onTrackAdvanced(marsBot, 2, 9);
      expect(triggerCount).to.eq(0);

      MarsBotCorpResolver.onTrackAdvanced(marsBot, 1, 3);
      expect(triggerCount).to.eq(1);
    });

    it('does not trigger when no cube at position', () => {
      const {marsBot} = createAutomaGame();
      let triggered = false;

      const corp = createTestCorp({
        name: CardName.ECOLINE,
        effect: {
          onTrackCubeTrigger: () => {
            triggered = true;
          },
        },
      });

      marsBot.corp = corp;
      MarsBotCorpResolver.onTrackAdvanced(marsBot, 1, 5);
      expect(triggered).to.be.false;
    });
  });


  describe('serialization round-trip', () => {
    it('preserves corp state through serialize/restore', () => {
      const {marsBot} = createAutomaGame();

      const corp = createTestCorp({
        name: CardName.ECOLINE,
        trackCubes: [{trackIndex: 1, position: 7, cubeType: 'credit'}],
      });

      registerMarsBotCorp(corp);
      marsBot.corp = corp;
      marsBot.trackCubePositions.set('1:7', {trackIndex: 1, position: 7, cubeType: 'credit'});
      marsBot.triggeredCubePositions.add('1:7');

      const serialized = marsBot.serialize();

      expect(serialized.corpId).to.eq(CardName.ECOLINE);
      expect(serialized.trackCubePositions).to.have.length(1);
      expect(serialized.triggeredCubePositions).to.deep.eq(['1:7']);

      // Create a fresh MarsBot and restore
      const {marsBot: marsBot2} = createAutomaGame();
      marsBot2.restoreState(serialized);

      expect(marsBot2.corp).to.not.be.undefined;
      expect(marsBot2.corp!.name).to.eq(CardName.ECOLINE);
      expect(marsBot2.trackCubePositions.size).to.eq(1);
      expect(marsBot2.hasCubeAt(1, 7)).to.not.be.undefined;
      expect(marsBot2.triggeredCubePositions.has('1:7')).to.be.true;
    });

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

  describe('registry', () => {
    it('registers and retrieves corps', () => {
      const corpA = createTestCorp({name: CardName.ECOLINE});
      registerMarsBotCorp(corpA);

      expect(getAllMarsBotCorps()).to.have.length(1);
      expect(getAllMarsBotCorps()[0].name).to.eq(CardName.ECOLINE);
    });

    it('duplicate registration overwrites', () => {
      const corpA = createTestCorp({name: CardName.ECOLINE, description: 'first'});
      registerMarsBotCorp(corpA);
      const corpB = createTestCorp({name: CardName.ECOLINE, description: 'second'});
      registerMarsBotCorp(corpB);

      expect(getAllMarsBotCorps().filter((c) => c.name === CardName.ECOLINE)).to.have.length(1);
      expect(getAllMarsBotCorps().find((c) => c.name === CardName.ECOLINE)?.description).to.eq('second');
    });
  });

  // The describes above start from an empty registry. These tests read the real corporations.
  describe('with every corporation registered', () => {
    beforeEach(restoreMarsBotCorpRegistry);

    it('selects a corp excluding human corp', () => {
      const rng = {next: () => 0, nextInt: (_n: number) => 0} as any;
      const corp = MarsBotCorpResolver.selectCorp(CardName.CREDICOR, DEFAULT_GAME_OPTIONS, rng);
      expect(corp).to.not.be.undefined;
      expect(corp!.name).to.not.eq(CardName.CREDICOR);
    });

    it('can select any of the 12 base corps', () => {
      const rng = {next: () => 0, nextInt: (_n: number) => 0} as any;
      // With Credicor excluded, should get Ecoline (index 0 of 11 remaining)
      const corp = MarsBotCorpResolver.selectCorp(CardName.CREDICOR, DEFAULT_GAME_OPTIONS, rng);
      expect(corp).to.not.be.undefined;
    });

    // Corp hook wiring
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
      marsBot['bonusResolver'].resolveEffect(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
    });

    // Starting tags resolve as a revealed card (rulebook B, setup step 4)
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
});
