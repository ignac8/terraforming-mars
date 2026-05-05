import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {MarsBotShippingBoard, COLONY_STORAGE_TAG} from '../../../src/server/automa/colonies/MarsBotShippingBoard';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {Tag} from '../../../src/common/cards/Tag';
import {BoardName} from '../../../src/common/boards/BoardName';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('MarsBotShippingBoard (C-18)', () => {
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
    it('COLONY_STORAGE_TAG maps Enceladus to PLANT (biome)', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.ENCELADUS]).to.eq(Tag.PLANT);
    });
    it('COLONY_STORAGE_TAG maps Miranda to PLANT (biome)', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.MIRANDA]).to.eq(Tag.PLANT);
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
    it('COLONY_STORAGE_TAG maps Pluto to EVENT (C-26)', () => {
      expect(COLONY_STORAGE_TAG[ColonyName.PLUTO]).to.eq(Tag.EVENT);
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
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      marsBot = getMarsBot(game);
    });

    it('stores resources for a normal colony', () => {
      marsBot.shippingBoard.add(ColonyName.CERES, 2, marsBot);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(2);
    });

    it('accumulates resources across multiple adds', () => {
      marsBot.shippingBoard.add(ColonyName.LUNA, 2, marsBot);
      marsBot.shippingBoard.add(ColonyName.LUNA, 1, marsBot);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(3);
    });

    it('silently ignores Europa (C-24d)', () => {
      marsBot.shippingBoard.add(ColonyName.EUROPA, 5, marsBot);
      expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0);
    });

    it('stores resources for Titan but no overflow check (C-23)', () => {
      // Add 7 to Titan; should NOT trigger track advance (exempt from C-12)
      const startPos = marsBot.board.getTrackIndexForTag(Tag.BUILDING);  // irrelevant track
      marsBot.shippingBoard.add(ColonyName.TITAN, 7, marsBot);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(7);
      // Track positions unchanged
      const eventTrackIdx = marsBot.board.getTrackIndexForTag(Tag.EVENT)!;
      expect(marsBot.board.tracks[eventTrackIdx].position).to.eq(0);
      void startPos; // suppress unused var
    });
  });

  describe('C-12 overflow: ≥5 resources → advance track', () => {
    let marsBot: MarsBot;

    beforeEach(() => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      marsBot = getMarsBot(game);
    });

    it('Ceres overflow advances Building track', () => {
      const buildingIdx = marsBot.board.getTrackIndexForTag(Tag.BUILDING)!;
      const before = marsBot.board.tracks[buildingIdx].position;
      marsBot.shippingBoard.add(ColonyName.CERES, 5, marsBot);
      expect(marsBot.board.tracks[buildingIdx].position).to.be.greaterThan(before);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(0);
    });

    it('Luna overflow advances Event track', () => {
      const eventIdx = marsBot.board.getTrackIndexForTag(Tag.EVENT)!;
      const before = marsBot.board.tracks[eventIdx].position;
      marsBot.shippingBoard.add(ColonyName.LUNA, 5, marsBot);
      expect(marsBot.board.tracks[eventIdx].position).to.be.greaterThan(before);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(0);
    });

    it('does NOT overflow below threshold (4 resources)', () => {
      const buildingIdx = marsBot.board.getTrackIndexForTag(Tag.BUILDING)!;
      const before = marsBot.board.tracks[buildingIdx].position;
      marsBot.shippingBoard.add(ColonyName.CERES, 4, marsBot);
      expect(marsBot.board.tracks[buildingIdx].position).to.eq(before);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(4);
    });

    it('leaves remainder after overflow', () => {
      marsBot.shippingBoard.add(ColonyName.CERES, 7, marsBot);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(2);
    });

    it('loops if ≥5 still after removal (adding 10 overflows twice)', () => {
      const buildingIdx = marsBot.board.getTrackIndexForTag(Tag.BUILDING)!;
      const before = marsBot.board.tracks[buildingIdx].position;
      marsBot.shippingBoard.add(ColonyName.CERES, 10, marsBot);
      expect(marsBot.board.tracks[buildingIdx].position).to.eq(before + 2);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(0);
    });

    it('partial overflow from previous + new resources', () => {
      marsBot.shippingBoard.add(ColonyName.CERES, 3, marsBot);
      const buildingIdx = marsBot.board.getTrackIndexForTag(Tag.BUILDING)!;
      const before = marsBot.board.tracks[buildingIdx].position;
      marsBot.shippingBoard.add(ColonyName.CERES, 2, marsBot); // total = 5 → overflow
      expect(marsBot.board.tracks[buildingIdx].position).to.eq(before + 1);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(0);
    });
  });

  describe('serialization', () => {
    it('round-trips shipping board storage', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      marsBot.shippingBoard.add(ColonyName.CERES, 3, marsBot);
      marsBot.shippingBoard.add(ColonyName.LUNA, 2, marsBot);

      const state = marsBot.serialize();
      expect(state.shippingBoard).to.not.be.undefined;

      const marsBot2 = getMarsBot(game); // Fresh ref from same game
      marsBot2.shippingBoard = new MarsBotShippingBoard();
      marsBot2.restoreState(state);

      expect(marsBot2.shippingBoard.get(ColonyName.CERES)).to.eq(3);
      expect(marsBot2.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
    });

    it('does not serialize shippingBoard when empty', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const state = marsBot.serialize();
      expect(state.shippingBoard).to.be.undefined;
    });
  });
});
