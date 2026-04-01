import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {MarsBotCorpResolver} from '../../../src/server/automa/corps/MarsBotCorpResolver';
import {IMarsBotCorp, MarsBotTrackCube} from '../../../src/server/automa/MarsBotCorpTypes';
import {
  registerMarsBotCorp,
  clearMarsBotCorpRegistry,
  getAllMarsBotCorps,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';
import {Tag} from '../../../src/common/cards/Tag';
import {CardName} from '../../../src/common/cards/CardName';
import {SeededRandom} from '../../../src/common/utils/Random';
import {BoardName} from '../../../src/common/boards/BoardName';

function createTestCorp(overrides: Partial<IMarsBotCorp> & {name: CardName}): IMarsBotCorp {
  return {
    description: '',
    startingTags: [],
    ...overrides,
  };
}

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: difficulty,
    boardName: BoardName.THARSIS,
  });
  expect(game.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.marsBot!};
}

describe('MarsBotCorpResolver', () => {
  beforeEach(() => {
    clearMarsBotCorpRegistry();
  });

  afterEach(() => {
    clearMarsBotCorpRegistry();
  });

  describe('selectCorp', () => {
    it('returns undefined with empty registry', () => {
      const rng = new SeededRandom(42);
      const result = MarsBotCorpResolver.selectCorp(CardName.ECOLINE, rng);
      expect(result).to.be.undefined;
    });

    it('selects a corp from registry', () => {
      const corpA = createTestCorp({name: CardName.ECOLINE});
      registerMarsBotCorp(corpA);

      const rng = new SeededRandom(42);
      const result = MarsBotCorpResolver.selectCorp(CardName.CREDICOR, rng);
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
      const result = MarsBotCorpResolver.selectCorp(CardName.ECOLINE, rng);
      expect(result).to.not.be.undefined;
      expect(result!.name).to.eq(CardName.HELION);
    });

    it('returns undefined when only corp matches human', () => {
      const corpA = createTestCorp({name: CardName.ECOLINE});
      registerMarsBotCorp(corpA);

      const rng = new SeededRandom(42);
      const result = MarsBotCorpResolver.selectCorp(CardName.ECOLINE, rng);
      expect(result).to.be.undefined;
    });
  });

  describe('setupCorp', () => {
    it('resolves starting tags by advancing tracks', () => {
      const {marsBot} = createAutomaGame();

      const corp = createTestCorp({
        id: CardName.ECOLINE,
        name: CardName.ECOLINE,
        startingTags: [Tag.BUILDING, Tag.BUILDING], // Track 1 should advance twice
      });

      const track1Before = marsBot.board.tracks[0].position;
      MarsBotCorpResolver.setupCorp(corp, marsBot);
      const track1After = marsBot.board.tracks[0].position;

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
        id: CardName.ECOLINE,
        name: 'Cube Corp',
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
        id: CardName.ECOLINE,
        name: 'Setup Corp',
        setup: {
          resolve: () => { setupCalled = true; },
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
        id: CardName.ECOLINE,
        name: 'Trigger Corp',
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

    it('does not re-trigger already triggered cubes', () => {
      const {marsBot} = createAutomaGame();
      let triggerCount = 0;

      const corp = createTestCorp({
        id: CardName.ECOLINE,
        name: 'No Re-Trigger',
        trackCubes: [{trackIndex: 1, position: 3, cubeType: 'white'}],
        effect: {
          onTrackCubeTrigger: () => { triggerCount++; },
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

    it('does not trigger when no cube at position', () => {
      const {marsBot} = createAutomaGame();
      let triggered = false;

      const corp = createTestCorp({
        id: CardName.ECOLINE,
        name: 'No Cube',
        effect: {
          onTrackCubeTrigger: () => { triggered = true; },
        },
      });

      marsBot.corp = corp;
      MarsBotCorpResolver.onTrackAdvanced(marsBot, 1, 5);
      expect(triggered).to.be.false;
    });
  });

  describe('resolvePerGenEffect', () => {
    it('calls per-gen resolve', () => {
      const {marsBot} = createAutomaGame();
      let called = false;

      const corp = createTestCorp({
        id: CardName.ECOLINE,
        name: 'PerGen Corp',
        perGeneration: {
          timing: 'roundStart',
          resolve: () => { called = true; },
        },
      });

      MarsBotCorpResolver.resolvePerGenEffect(corp, marsBot);
      expect(called).to.be.true;
    });

    it('does nothing if no per-gen effect', () => {
      const {marsBot} = createAutomaGame();

      const corp = createTestCorp({
        id: CardName.ECOLINE,
        name: 'No PerGen',
      });

      // Should not throw
      MarsBotCorpResolver.resolvePerGenEffect(corp, marsBot);
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
  });

  describe('registry', () => {
    it('registers and retrieves corps', () => {
      const corpA = createTestCorp({name: CardName.ECOLINE});
      registerMarsBotCorp(corpA);

      expect(getAllMarsBotCorps()).to.have.length(1);
      expect(getAllMarsBotCorps()[0].name).to.eq(CardName.ECOLINE);
    });

    it('throws on duplicate registration', () => {
      const corpA = createTestCorp({name: CardName.ECOLINE});
      registerMarsBotCorp(corpA);

      expect(() => registerMarsBotCorp(corpA)).to.throw('already registered');
    });
  });
});
