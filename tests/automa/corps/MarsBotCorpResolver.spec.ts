import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {MarsBotCorpResolver} from '../../../src/server/automa/corps/MarsBotCorpResolver';
import {MarsBotCorpId, IMarsBotCorp, MarsBotTrackCube} from '../../../src/common/automa/MarsBotCorpTypes';
import {
  registerMarsBotCorp,
  clearMarsBotCorpRegistry,
  getAllMarsBotCorps,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';
import {Tag} from '../../../src/common/cards/Tag';
import {CardName} from '../../../src/common/cards/CardName';
import {SeededRandom} from '../../../src/common/utils/Random';
import {BoardName} from '../../../src/common/boards/BoardName';

const TEST_CORP_ID_A = 'TEST_CORP_A' as MarsBotCorpId;
const TEST_CORP_ID_B = 'TEST_CORP_B' as MarsBotCorpId;

function createTestCorp(overrides: Partial<IMarsBotCorp> & {id: MarsBotCorpId, name: string}): IMarsBotCorp {
  return {
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
      const corpA = createTestCorp({id: TEST_CORP_ID_A, name: 'Test Corp A'});
      registerMarsBotCorp(corpA);

      const rng = new SeededRandom(42);
      const result = MarsBotCorpResolver.selectCorp(CardName.ECOLINE, rng);
      expect(result).to.not.be.undefined;
      expect(result!.name).to.eq('Test Corp A');
    });

    it('excludes corp matching human corp name', () => {
      const corpA = createTestCorp({id: TEST_CORP_ID_A, name: CardName.ECOLINE});
      const corpB = createTestCorp({id: TEST_CORP_ID_B, name: 'Other Corp'});
      registerMarsBotCorp(corpA);
      registerMarsBotCorp(corpB);

      const rng = new SeededRandom(42);
      // Human has EcoLine, so MarsBot should get Other Corp
      const result = MarsBotCorpResolver.selectCorp(CardName.ECOLINE, rng);
      expect(result).to.not.be.undefined;
      expect(result!.name).to.eq('Other Corp');
    });

    it('returns undefined when only corp matches human', () => {
      const corpA = createTestCorp({id: TEST_CORP_ID_A, name: CardName.ECOLINE});
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
        id: TEST_CORP_ID_A,
        name: 'Test Corp',
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
        id: TEST_CORP_ID_A,
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
        id: TEST_CORP_ID_A,
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
        id: TEST_CORP_ID_A,
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
        id: TEST_CORP_ID_A,
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
        id: TEST_CORP_ID_A,
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
        id: TEST_CORP_ID_A,
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
        id: TEST_CORP_ID_A,
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
        id: TEST_CORP_ID_A,
        name: 'Serial Corp',
        trackCubes: [{trackIndex: 1, position: 7, cubeType: 'credit'}],
      });

      registerMarsBotCorp(corp);
      marsBot.corp = corp;
      marsBot.trackCubePositions.set('1:7', {trackIndex: 1, position: 7, cubeType: 'credit'});
      marsBot.triggeredCubePositions.add('1:7');

      const serialized = marsBot.serialize();

      expect(serialized.corpId).to.eq(TEST_CORP_ID_A);
      expect(serialized.trackCubePositions).to.have.length(1);
      expect(serialized.triggeredCubePositions).to.deep.eq(['1:7']);

      // Create a fresh MarsBot and restore
      const {marsBot: marsBot2} = createAutomaGame();
      marsBot2.restoreState(serialized);

      expect(marsBot2.corp).to.not.be.undefined;
      expect(marsBot2.corp!.name).to.eq('Serial Corp');
      expect(marsBot2.trackCubePositions.size).to.eq(1);
      expect(marsBot2.hasCubeAt(1, 7)).to.not.be.undefined;
      expect(marsBot2.triggeredCubePositions.has('1:7')).to.be.true;
    });
  });

  describe('registry', () => {
    it('registers and retrieves corps', () => {
      const corpA = createTestCorp({id: TEST_CORP_ID_A, name: 'Corp A'});
      registerMarsBotCorp(corpA);

      expect(getAllMarsBotCorps()).to.have.length(1);
      expect(getAllMarsBotCorps()[0].name).to.eq('Corp A');
    });

    it('throws on duplicate registration', () => {
      const corpA = createTestCorp({id: TEST_CORP_ID_A, name: 'Corp A'});
      registerMarsBotCorp(corpA);

      expect(() => registerMarsBotCorp(corpA)).to.throw('already registered');
    });
  });
});
