import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceType} from '@/common/boards/SpaceType';
import {DEFAULT_GAME_OPTIONS} from '@/server/game/GameOptions';
import {AmazonisPlanitiaBoard} from '@/server/boards/AmazonisPlanitiaBoard';
import {SeededRandom} from '@/common/utils/Random';
import {testGame} from '@tests/TestGame';

describe('probe shape: geometry', () => {
  const board = AmazonisPlanitiaBoard.newInstance(DEFAULT_GAME_OPTIONS, new SeededRandom(0));
  const mars = board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY);

  // Independent doubled-horizontal hex coords. Row widths 6..11..6.
  const widths = [6, 7, 8, 9, 10, 11, 10, 9, 8, 7, 6];
  const byXY = new Map(mars.map((s) => [`${s.x},${s.y}`, s]));
  function expectedNeighbours(x: number, y: number): Set<string> {
    const w = widths[y];
    const i = x - (11 - w);
    const dx = 2 * i + (11 - w);
    const out = new Set<string>();
    for (const [ddx, ddy] of [[-1, -1], [1, -1], [2, 0], [1, 1], [-1, 1], [-2, 0]]) {
      const ny = y + ddy;
      if (ny < 0 || ny > 10) continue;
      const nx2 = dx + ddx;
      const nw = widths[ny];
      const ni2 = nx2 - (11 - nw);
      if (ni2 < 0 || ni2 % 2 !== 0) continue;
      const ni = ni2 / 2;
      if (ni < 0 || ni >= nw) continue;
      out.add(byXY.get(`${ni + (11 - nw)},${ny}`)!.id);
    }
    return out;
  }

  it('91 mars spaces', () => {
    expect(mars).has.length(91);
  });

  it('adjacency matches independent hex geometry for all 91', () => {
    const bad: Array<string> = [];
    for (const s of mars) {
      const got = new Set(board.getAdjacentSpaces(s).map((a) => a.id));
      const want = expectedNeighbours(s.x, s.y);
      if (got.size !== want.size || [...got].some((g) => !want.has(g))) bad.push(`${s.id} got ${[...got]} want ${[...want]}`);
    }
    expect(bad).deep.eq([]);
  });

  it('adjacency is symmetric', () => {
    const bad: Array<string> = [];
    for (const s of mars) {
      for (const a of board.getAdjacentSpaces(s)) {
        if (!board.getAdjacentSpaces(a).includes(s)) bad.push(`${s.id}->${a.id}`);
      }
    }
    expect(bad).deep.eq([]);
  });

  it('edge flag == fewer than 6 neighbours', () => {
    const bad = mars.filter((s) => (board.getAdjacentSpaces(s).length < 6) !== s.edge).map((s) => `${s.id}:${board.getAdjacentSpaces(s).length}:${s.edge}`);
    expect(bad).deep.eq([]);
  });

  it('A9 labels cover every mars space exactly once', () => {
    const labels = mars.map((s) => board.A9[s.id]);
    expect(labels.every((l) => l !== undefined)).is.true;
    expect(new Set(labels).size).eq(91);
  });

  it('A9 label row letter matches y; label number is position in row', () => {
    const letters = 'ABCDEFGHJKL';
    const bad = mars.filter((s) => {
      const l = board.A9[s.id]!;
      const idx = s.x - (11 - widths[s.y]) + 1;
      return l !== letters[s.y] + idx;
    }).map((s) => `${s.id} ${board.A9[s.id]} x${s.x} y${s.y}`);
    expect(bad).deep.eq([]);
  });

  it('volcanic spaces are named as documented', () => {
    expect(board.volcanicSpaceIds.map((id) => board.A9[id])).to.have.members(['E1', 'H7', 'H9', 'J8', 'K7']);
  });

  for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    it('shuffle seed ' + seed + ': preserves counts and volcanic', () => {
      const orig = AmazonisPlanitiaBoard.newInstance(DEFAULT_GAME_OPTIONS, new SeededRandom(0));
      const shuffled = AmazonisPlanitiaBoard.newInstance({...DEFAULT_GAME_OPTIONS, shuffleMapOption: true}, new SeededRandom(seed));
      const count = (b: AmazonisPlanitiaBoard, t: SpaceType) => b.spaces.filter((s) => s.spaceType === t).length;
      expect(count(shuffled, SpaceType.OCEAN)).eq(count(orig, SpaceType.OCEAN));
      expect(count(shuffled, SpaceType.LAND)).eq(count(orig, SpaceType.LAND));
      expect(shuffled.volcanicSpaceIds).deep.eq(orig.volcanicSpaceIds);
      const bonuses = (b: AmazonisPlanitiaBoard) => b.spaces.flatMap((s) => s.bonus).sort();
      expect(bonuses(shuffled)).deep.eq(bonuses(orig));
      for (const id of orig.volcanicSpaceIds) {
        expect(shuffled.getSpaceOrThrow(id).bonus).deep.eq(orig.getSpaceOrThrow(id).bonus);
        expect(shuffled.getSpaceOrThrow(id).spaceType).eq(SpaceType.LAND);
      }
    });
  }

  it('game with shuffleMapOption on Amazonis Planitia starts', () => {
    for (let i = 0; i < 5; i++) {
      const [game] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, shuffleMapOption: true});
      expect(game.board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY)).has.length(91);
    }
  });
});
