import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {Tag} from '@/common/cards/Tag';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotShippingBoard} from '@/server/automa/colonies/MarsBotShippingBoard';
import {testGame} from '../../TestGame';
import {fakeMarsBot} from '../FakeMarsBot';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {COLONY_STORAGE_TAG} from '../../../src/server/automa/colonies/MarsBotShippingBoard';
import {BoardName} from '../../../src/common/boards/BoardName';

function shippingBoard() {
  const [game] = testGame(1);
  const advanced: Array<Tag> = [];
  const board = new MarsBotShippingBoard(fakeMarsBot({game, advanceTrackOfTag: (tag) => advanced.push(tag) > 0}));
  return {game, board, advanced};
}

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('MarsBotShippingBoard', () => {
  for (const run of [
    {colonyName: ColonyName.CERES, amounts: [4], expected: {stored: 4, advanced: []}},
    {colonyName: ColonyName.CERES, amounts: [3, 2], expected: {stored: 0, advanced: [Tag.BUILDING]}},
    {colonyName: ColonyName.ENCELADUS, amounts: [12], expected: {stored: 2, advanced: [Tag.MICROBE, Tag.MICROBE]}},
    {colonyName: ColonyName.EUROPA, amounts: [5], expected: {stored: 0, advanced: []}},
    {colonyName: ColonyName.TITAN, amounts: [7], expected: {stored: 7, advanced: []}},
  ] as const) {
    it("advances the storage area's track for every 5 resources: " + JSON.stringify(run), () => {
      const {board, advanced} = shippingBoard();

      for (const amount of run.amounts) {
        board.add(run.colonyName, amount);
      }

      expect(board.get(run.colonyName)).eq(run.expected.stored);
      expect(advanced).deep.eq(run.expected.advanced);
    });
  }

  it('advances no track once the game is decided', () => {
    const {game, board, advanced} = shippingBoard();
    game.phase = Phase.END;

    board.add(ColonyName.CERES, 5);

    expect(board.get(ColonyName.CERES)).eq(5);
    expect(advanced).is.empty;
  });

  describe('storage and resource mapping (C-25)', () => {
    it('COLONY_STORAGE_TAG maps Ceres to BUILDING', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.CERES]).to.eq(Tag.BUILDING);
    });
    it('COLONY_STORAGE_TAG maps Luna to EVENT', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.LUNA]).to.eq(Tag.EVENT);
    });
    it('COLONY_STORAGE_TAG maps Io to EARTH', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.IO]).to.eq(Tag.EARTH);
    });
    it('COLONY_STORAGE_TAG maps Enceladus to MICROBE', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.ENCELADUS]).to.eq(Tag.MICROBE);
    });
    it('COLONY_STORAGE_TAG maps Miranda to ANIMAL', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.MIRANDA]).to.eq(Tag.ANIMAL);
    });
    it('COLONY_STORAGE_TAG maps Ganymede to PLANT', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.GANYMEDE]).to.eq(Tag.PLANT);
    });
    it('COLONY_STORAGE_TAG maps Callisto to POWER', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.CALLISTO]).to.eq(Tag.POWER);
    });
    it('COLONY_STORAGE_TAG maps Triton to SPACE', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.TRITON]).to.eq(Tag.SPACE);
    });
    it('COLONY_STORAGE_TAG maps Pluto to SCIENCE (C-26)', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.PLUTO]).to.eq(Tag.SCIENCE);
    });
    it('COLONY_STORAGE_TAG has no entry for Titan (exempt from C-12, C-23)', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.TITAN]).to.be.undefined;
    });
    it('COLONY_STORAGE_TAG has no entry for Europa (no storage, C-24d)', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.EUROPA]).to.be.undefined;
    });
  });

  describe('add() behaviour', () => {
    let marsBot: MarsBot;

    beforeEach(() => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      marsBot = getMarsBot(game);
    });

    it('stores resources for a normal colony', () => {
      marsBot.shippingBoard.add(ColonyName.CERES, 2);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(2);
    });

    it('accumulates resources across multiple adds', () => {
      marsBot.shippingBoard.add(ColonyName.LUNA, 2);
      marsBot.shippingBoard.add(ColonyName.LUNA, 1);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(3);
    });

    it('silently ignores Europa (C-24d)', () => {
      marsBot.shippingBoard.add(ColonyName.EUROPA, 5);
      expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0);
    });

    it('stores resources for Titan but no overflow check (C-23)', () => {
      marsBot.shippingBoard.add(ColonyName.TITAN, 7);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(7);
      const eventTrackIdx = marsBot.marsBotBoard.tagToTrack[Tag.EVENT]!;
      expect(marsBot.marsBotBoard.tracks[eventTrackIdx].position).to.eq(0);
    });
  });

  describe('C-12 overflow: ≥5 resources → advance track', () => {
    let marsBot: MarsBot;

    beforeEach(() => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      marsBot = getMarsBot(game);
    });

    it('Ceres overflow advances Building track', () => {
      const buildingIdx = marsBot.marsBotBoard.tagToTrack[Tag.BUILDING]!;
      const before = marsBot.marsBotBoard.tracks[buildingIdx].position;
      marsBot.shippingBoard.add(ColonyName.CERES, 5);
      expect(marsBot.marsBotBoard.tracks[buildingIdx].position).to.be.greaterThan(before);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(0);
    });

    it('Luna overflow advances Event track', () => {
      const eventIdx = marsBot.marsBotBoard.tagToTrack[Tag.EVENT]!;
      const before = marsBot.marsBotBoard.tracks[eventIdx].position;
      marsBot.shippingBoard.add(ColonyName.LUNA, 5);
      expect(marsBot.marsBotBoard.tracks[eventIdx].position).to.be.greaterThan(before);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(0);
    });

    it('does NOT overflow below threshold (4 resources)', () => {
      const buildingIdx = marsBot.marsBotBoard.tagToTrack[Tag.BUILDING]!;
      const before = marsBot.marsBotBoard.tracks[buildingIdx].position;
      marsBot.shippingBoard.add(ColonyName.CERES, 4);
      expect(marsBot.marsBotBoard.tracks[buildingIdx].position).to.eq(before);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(4);
    });

    it('leaves remainder after overflow', () => {
      marsBot.shippingBoard.add(ColonyName.CERES, 7);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(2);
    });

    it('loops if ≥5 still after removal (adding 10 overflows twice)', () => {
      const buildingIdx = marsBot.marsBotBoard.tagToTrack[Tag.BUILDING]!;
      const before = marsBot.marsBotBoard.tracks[buildingIdx].position;
      marsBot.shippingBoard.add(ColonyName.CERES, 10);
      expect(marsBot.marsBotBoard.tracks[buildingIdx].position).to.eq(before + 2);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(0);
    });

    it('partial overflow from previous + new resources', () => {
      marsBot.shippingBoard.add(ColonyName.CERES, 3);
      const buildingIdx = marsBot.marsBotBoard.tagToTrack[Tag.BUILDING]!;
      const before = marsBot.marsBotBoard.tracks[buildingIdx].position;
      marsBot.shippingBoard.add(ColonyName.CERES, 2);
      expect(marsBot.marsBotBoard.tracks[buildingIdx].position).to.eq(before + 1);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(0);
    });
  });

  describe('serialization', () => {
    it('round-trips shipping board storage', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      marsBot.shippingBoard.add(ColonyName.CERES, 3);
      marsBot.shippingBoard.add(ColonyName.LUNA, 2);

      const state = marsBot.serialize();
      expect(state.shippingBoard).to.not.be.undefined;

      const marsBot2 = getMarsBot(game);
      marsBot2.shippingBoard = new MarsBotShippingBoard(marsBot2);
      marsBot2.restoreState(state);

      expect(marsBot2.shippingBoard.get(ColonyName.CERES)).to.eq(3);
      expect(marsBot2.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
    });

    it('does not serialize shippingBoard when empty', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const state = marsBot.serialize();
      expect(state.shippingBoard).to.be.undefined;
    });
  });
});
