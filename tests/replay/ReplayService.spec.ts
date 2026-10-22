import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {clearReplayCache, forgetReplay, getReplayMoves, isFinished, loadReplayState} from '../../src/server/replay/ReplayService';
import {RouteError} from '../../src/server/routes/RouteError';
import {LogMessage} from '../../src/common/logs/LogMessage';
import {LogMessageType} from '../../src/common/logs/LogMessageType';
import {Phase} from '../../src/common/Phase';
import {PlayerId} from '../../src/common/Types';
import {ReplayMove, ReplayMovesModel} from '../../src/common/replay/ReplayModel';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';

describe('ReplayService', () => {
  let db: InMemoryDatabase;
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;
  let base: SerializedGame;
  let warnings: Array<Array<unknown>>;
  const originalWarn = console.warn;

  beforeEach(() => {
    warnings = [];
    console.warn = (...args: Array<unknown>) => {
      warnings.push(args);
    };
    db = new InMemoryDatabase();
    setTestDatabase(db);
    clearReplayCache();
    [game, player, player2] = testGame(2);
    base = game.serialize();
  });

  afterEach(() => {
    console.warn = originalWarn;
    restoreTestDatabase();
    clearReplayCache();
  });

  // The log of the final save: message i reads `line i`.
  function logOf(length: number, privateTo: Map<number, PlayerId> = new Map()): Array<LogMessage> {
    return Array.from({length}, (_, i) => new LogMessage(LogMessageType.DEFAULT, `line ${i}`, [], privateTo.get(i)));
  }

  function row(log: Array<LogMessage>, length: number, generation: number = 1): SerializedGame {
    return {...base, generation, gameLog: log.slice(0, length)};
  }

  // Stores rows at the given save ids and marks the live game as finished.
  function storeSaves(saves: Array<[number, SerializedGame]>) {
    const rows: Array<SerializedGame | undefined> = [];
    for (const [saveId, save] of saves) {
      rows[saveId] = save;
    }
    // The newest save of a finished game is in the END phase.
    const last = rows.length - 1;
    rows[last] = {...rows[last]!, phase: Phase.END};
    db.games.set(game.id, rows);
    game.phase = Phase.END;
  }

  function storeLengths(lengths: Array<number>, privateTo?: Map<number, PlayerId>) {
    const log = logOf(Math.max(...lengths), privateTo);
    storeSaves(lengths.map((n, idx) => [idx, row(log, n)]));
  }

  async function moves(viewerId: string = player.id): Promise<Array<ReplayMove>> {
    const r = await getReplayMoves(game, viewerId as PlayerId);
    expect(r.status).eq('available');
    return (r as {moves: Array<ReplayMove>}).moves;
  }

  it('refuses a game that is still running', async () => {
    storeLengths([0, 2, 5]);
    game.phase = Phase.ACTION;
    expect(await getReplayMoves(game, player.id)).deep.eq({status: 'not-finished'});
  });

  it('lists one move per save, collapsing duplicate saves', async () => {
    storeLengths([0, 2, 5, 5, 9]);
    const r = await getReplayMoves(game, player.id);
    expect(r.status).eq('available');
    const list = (r as {moves: Array<ReplayMove>}).moves;
    expect(list.map((m) => m.saveId)).deep.eq([0, 1, 3, 4]);
    expect(list.map((m) => m.messages.length)).deep.eq([2, 3, 4, 0]);
    expect(list[1].messages.map((m) => m.message)).deep.eq(['line 2', 'line 3', 'line 4']);
  });

  it('hides other players\' private log lines', async () => {
    // Line 0 is public, 1 is private to player, 2 is private to player2, 3 is public.
    storeLengths([0, 4, 4, 4], new Map([[1, player.id], [2, player2.id]]));
    const forPlayer = await moves(player.id);
    expect(forPlayer[0].messages.map((m) => m.message)).deep.eq(['line 0', 'line 1', 'line 3']);
    clearReplayCache();
    const forPlayer2 = await moves(player2.id);
    expect(forPlayer2[0].messages.map((m) => m.message)).deep.eq(['line 0', 'line 2', 'line 3']);
  });

  it('shows a spectator only public lines', async () => {
    storeLengths([0, 4, 4, 4], new Map([[1, player.id], [2, player2.id]]));
    expect((await moves('s-spectator'))[0].messages.map((m) => m.message)).deep.eq(['line 0', 'line 3']);
  });

  describe('for a judge', () => {
    beforeEach(() => {
      [game, player, player2] = testGame(2, {judgeLink: true});
      base = game.serialize();
      // Line 0 is public, 1 is private to player, 2 is private to player2, 3 is public.
      storeLengths([0, 4, 4, 4], new Map([[1, player.id], [2, player2.id]]));
    });

    it('shows every line, each private one marked with its owner', async () => {
      const messages = (await moves(game.judgeId))[0].messages;
      expect(messages.map((m) => m.message)).deep.eq(['line 0', 'line 1', 'line 2', 'line 3']);
      expect(messages.map((m) => m.owner)).deep.eq([undefined, player.color, player2.color, undefined]);
    });

    it('never shows a player id', async () => {
      const list = await moves(game.judgeId);
      const json = JSON.stringify(list);
      expect(json).not.contains(player.id);
      expect(json).not.contains(player2.id);
      expect(list[0].messages.some((m) => m.playerId !== undefined)).is.false;
    });

    it('does not change what players and spectators see', async () => {
      await moves(game.judgeId);
      expect((await moves(player.id))[0].messages.map((m) => m.message)).deep.eq(['line 0', 'line 1', 'line 3']);
      expect((await moves(player2.id))[0].messages.map((m) => m.message)).deep.eq(['line 0', 'line 2', 'line 3']);
      expect((await moves(game.spectatorId))[0].messages.map((m) => m.message)).deep.eq(['line 0', 'line 3']);
      expect(JSON.stringify(await moves(player.id))).contains(player.id);
    });
  });

  it('does not share cached messages between viewers', async () => {
    storeLengths([0, 4, 4, 4], new Map([[1, player.id]]));
    expect((await moves(player.id))[0].messages).has.length(4);
    expect((await moves(player2.id))[0].messages).has.length(3);
  });

  it('waits for the END save and does not cache the list built before it', async () => {
    const log = logOf(9);
    // The live game is already in END but the final save has not been written yet.
    const rows: Array<SerializedGame | undefined> = [
      {...row(log, 0), phase: Phase.ACTION},
      {...row(log, 4), phase: Phase.ACTION},
      {...row(log, 7), phase: Phase.ACTION},
    ];
    db.games.set(game.id, rows);
    game.phase = Phase.END;
    expect(await getReplayMoves(game, player.id)).deep.eq({status: 'not-finished'});

    rows.push({...row(log, 9), phase: Phase.END});
    const list = await moves();
    expect(list.map((m) => m.saveId)).deep.eq([0, 1, 2, 3]);
    expect(list.map((m) => m.messages.length)).deep.eq([4, 3, 2, 0]);
  });

  it('reads only the newest save while the END save has not landed', async () => {
    const log = logOf(9);
    const rows: Array<SerializedGame | undefined> = [0, 3, 6, 8].map((n) => ({...row(log, n), phase: Phase.ACTION}));
    db.games.set(game.id, rows);
    game.phase = Phase.END;
    const reads: Array<number> = [];
    const getGameVersion = db.getGameVersion.bind(db);
    db.getGameVersion = (gameId, saveId) => {
      reads.push(saveId);
      return getGameVersion(gameId, saveId);
    };
    expect(await getReplayMoves(game, player.id)).deep.eq({status: 'not-finished'});
    expect(reads).deep.eq([3]);
  });

  it('reports expired once only the first and last save remain', async () => {
    const log = logOf(9);
    storeSaves([[0, row(log, 0)], [9, row(log, 9)]]);
    expect(await getReplayMoves(game, player.id)).deep.eq({status: 'expired'});
  });

  it('sorts save ids numerically, not as text', async () => {
    const log = logOf(30);
    storeSaves([[2, row(log, 4)], [10, row(log, 20)], [9, row(log, 10)], [0, row(log, 0)]]);
    expect((await moves()).map((m) => m.saveId)).deep.eq([0, 2, 9, 10]);
  });

  it('works with gaps from saves trimmed before this shipped', async () => {
    const log = logOf(20);
    storeSaves([[0, row(log, 0)], [57, row(log, 5)], [58, row(log, 12)], [59, row(log, 20)]]);
    expect((await moves()).map((m) => m.saveId)).deep.eq([0, 57, 58, 59]);
  });

  it('keeps the last save even when it repeats the previous log length', async () => {
    storeLengths([0, 3, 3]);
    expect((await moves()).map((m) => m.saveId)).deep.eq([0, 2]);
  });

  it('caches the move list of a finished game', async () => {
    storeLengths([0, 2, 5]);
    const first = await getReplayMoves(game, player.id);
    db.games.delete(game.id);
    expect(await getReplayMoves(game, player.id)).deep.eq(first);
  });

  it('builds the move list once per game, whoever asks', async () => {
    storeLengths([0, 2, 5]);
    await getReplayMoves(game, player.id);
    db.games.delete(game.id);
    expect((await getReplayMoves(game, player2.id)).status).eq('available');
    expect((await getReplayMoves(game, 's-spectator' as PlayerId)).status).eq('available');
  });

  it('answers not-finished for a cached game that runs again', async () => {
    storeLengths([0, 2, 5]);
    expect((await getReplayMoves(game, player.id)).status).eq('available');
    game.phase = Phase.ACTION;
    expect(await getReplayMoves(game, player.id)).deep.eq({status: 'not-finished'});
  });

  it('forgetReplay makes a rolled back game read its saves again', async () => {
    storeLengths([0, 2, 5, 9]);
    const other = testGame(2, {}, '-other')[0];
    db.games.set(other.id, [...db.games.get(game.id)!]);
    other.phase = Phase.END;
    expect(await moves()).has.length(4);
    const otherList = await getReplayMoves(other, other.playersInGenerationOrder[0].id);
    // The rollback removes the END save.
    db.games.get(game.id)!.pop();

    forgetReplay(game.id);

    expect(await getReplayMoves(game, player.id)).deep.eq({status: 'not-finished'});
    expect(await getReplayMoves(other, other.playersInGenerationOrder[0].id)).deep.eq(otherList);
  });

  it('drops the oldest cached game past 50 games', async () => {
    storeLengths([0, 2, 5]);
    const copy = db.games.get(game.id)!;
    function other(i: number): IGame {
      db.games.set(`g-${i}`, copy);
      return {id: `g-${i}`, phase: Phase.END} as IGame;
    }
    const first = other(0);
    await getReplayMoves(first, player.id);
    for (let i = 1; i < 50; i++) {
      await getReplayMoves(other(i), player.id);
    }
    let reads = 0;
    const getGameVersion = db.getGameVersion.bind(db);
    db.getGameVersion = (gameId, saveId) => {
      reads++;
      return getGameVersion(gameId, saveId);
    };
    // Still 50 games, so the first one is cached.
    await getReplayMoves(first, player.id);
    expect(reads).eq(0);
    await getReplayMoves(other(50), player.id);
    reads = 0;
    // The 51st game pushed the first one out, so it is built again from the saves.
    await getReplayMoves(first, player.id);
    expect(reads).greaterThan(0);
  });

  it('reads each save once for viewers who ask at the same time', async () => {
    storeLengths([0, 2, 5, 9]);
    const reads: Array<number> = [];
    const getGameVersion = db.getGameVersion.bind(db);
    db.getGameVersion = (gameId, saveId) => {
      reads.push(saveId);
      return getGameVersion(gameId, saveId);
    };
    const results = await Promise.all([
      getReplayMoves(game, player.id),
      getReplayMoves(game, player2.id),
      getReplayMoves(game, 's-spectator' as PlayerId),
    ]);
    for (const r of results) {
      expect(r.status).eq('available');
    }
    expect(reads.sort()).deep.eq([0, 1, 2, 3]);
  });

  it('gives each concurrent viewer only their own private lines', async () => {
    storeLengths([0, 4, 4, 4], new Map([[1, player.id], [2, player2.id]]));
    const [forPlayer, forPlayer2, forSpectator] = await Promise.all([
      getReplayMoves(game, player.id),
      getReplayMoves(game, player2.id),
      getReplayMoves(game, 's-spectator' as PlayerId),
    ]);
    const lines = (r: ReplayMovesModel) => (r as {moves: Array<ReplayMove>}).moves[0].messages.map((m) => m.message);
    expect(lines(forPlayer)).deep.eq(['line 0', 'line 1', 'line 3']);
    expect(lines(forPlayer2)).deep.eq(['line 0', 'line 2', 'line 3']);
    expect(lines(forSpectator)).deep.eq(['line 0', 'line 3']);
  });

  it('does not hand one viewer the message array of another', async () => {
    storeLengths([0, 4, 4, 4]);
    const a = await getReplayMoves(game, player.id) as {moves: Array<ReplayMove>};
    const b = await getReplayMoves(game, player2.id) as {moves: Array<ReplayMove>};
    expect(a.moves[0].messages).not.eq(b.moves[0].messages);
  });

  it('shares a failed build, then builds again on the next request', async () => {
    storeLengths([0, 2, 5]);
    const getGameVersion = db.getGameVersion.bind(db);
    db.getGameVersion = () => Promise.reject(new Error('Game not found'));
    const failures = await Promise.all([
      errorOf(getReplayMoves(game, player.id)),
      errorOf(getReplayMoves(game, player2.id)),
    ]);
    for (const e of failures) {
      expect(e).instanceOf(RouteError);
    }

    db.getGameVersion = getGameVersion;
    expect((await moves()).map((m) => m.saveId)).deep.eq([0, 1, 2]);
  });

  it('does not cache a build that forgetReplay superseded', async () => {
    storeLengths([0, 2, 5]);
    const rows = db.games.get(game.id)!;
    const getGameVersion = db.getGameVersion.bind(db);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    db.getGameVersion = async (gameId, saveId) => {
      const save = await getGameVersion(gameId, saveId);
      // Only the last read waits, so the build has the whole old list by then.
      if (saveId === 2) {
        await gate;
      }
      return save;
    };
    const stale = getReplayMoves(game, player.id);
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    // A rollback replaces the saves while the build is still reading.
    forgetReplay(game.id);
    rows.pop();
    release();
    // The request that was waiting still gets the list it asked for.
    expect((await stale).status).eq('available');

    db.getGameVersion = getGameVersion;
    expect(await getReplayMoves(game, player.id)).deep.eq({status: 'not-finished'});
  });

  it('does not change the live game', async () => {
    storeLengths([0, 2, 5]);
    const before = JSON.stringify(game.serialize());
    await getReplayMoves(game, player.id);
    await loadReplayState(game, 1);
    expect(JSON.stringify(game.serialize())).eq(before);
  });

  it('loadReplayState returns a sandbox game at that save', async () => {
    const log = logOf(5);
    storeSaves([[0, row(log, 0, 1)], [1, row(log, 2, 4)], [2, row(log, 5, 6)]]);
    const replayed = await loadReplayState(game, 1);
    expect(replayed.isSandbox).is.true;
    expect(replayed.generation).eq(4);
  });

  describe('after a rewind', () => {
    beforeEach(() => {
      // Save 2 restored save 1, so saves 1 up to 2 are the abandoned line.
      storeLengths([0, 2, 4, 5]);
      const rows = db.games.get(game.id)!;
      const rewinds = [{saveId: 2, restoredSaveId: 1, logStart: 2, logEnd: 3}];
      rows[3] = {...rows[3]!, rewinds};
      game.rewinds = rewinds;
    });

    it('lists only the saves of the line that was kept', async () => {
      expect((await moves()).map((m) => m.saveId)).deep.eq([0, 2, 3]);
    });

    it('loadReplayState answers notFound for an abandoned save', async () => {
      expect(await errorOf(loadReplayState(game, 1))).deep.include({kind: 'notFound'});
      expect((await loadReplayState(game, 2)).isSandbox).is.true;
    });
  });

  it('loadReplayState rejects a save id the game does not have', async () => {
    storeLengths([0, 2, 5]);
    for (const saveId of [3, -1]) {
      let error: unknown;
      try {
        await loadReplayState(game, saveId);
      } catch (e) {
        error = e;
      }
      expect(error).instanceOf(RouteError);
      expect((error as RouteError).kind).eq('notFound');
    }
  });

  async function errorOf(promise: Promise<unknown>): Promise<unknown> {
    try {
      await promise;
    } catch (e) {
      return e;
    }
    return undefined;
  }

  it('loadReplayState answers notFound when compression removed the save meanwhile', async () => {
    storeLengths([0, 2, 5]);
    db.getGameVersion = () => Promise.reject(new Error('Game not found'));
    const error = await errorOf(loadReplayState(game, 1));
    expect(error).instanceOf(RouteError);
    expect(error).deep.include({kind: 'notFound', detail: 'save not available'});
    expect(warnings).has.length(1);
    expect(String(warnings[0][0])).contains(game.id).and.contains('1');
    expect((warnings[0][1] as Error).message).eq('Game not found');
  });

  it('loadReplayState answers notFound for a save the code cannot deserialize', async () => {
    storeLengths([0, 2, 5]);
    db.games.get(game.id)![1] = {...base, board: undefined} as unknown as SerializedGame;
    const error = await errorOf(loadReplayState(game, 1));
    expect(error).instanceOf(RouteError);
    expect(error).deep.include({kind: 'notFound', detail: 'save not available'});
    expect(warnings).has.length(1);
    expect(String(warnings[0][0])).contains(game.id);
    expect(warnings[0][1]).instanceOf(TypeError);
  });

  it('getReplayMoves answers notFound when a save cannot be read', async () => {
    storeLengths([0, 2, 5]);
    db.getGameVersion = () => Promise.reject(new Error('Game not found'));
    const error = await errorOf(getReplayMoves(game, player.id));
    expect(error).instanceOf(RouteError);
    expect(error).deep.include({kind: 'notFound', detail: 'save not available'});
    expect(warnings).has.length(1);
  });

  it('loadReplayState keeps a RouteError from the database as it is', async () => {
    storeLengths([0, 2, 5]);
    db.getGameVersion = () => Promise.reject(RouteError.forbidden('no'));
    const error = await errorOf(loadReplayState(game, 1));
    expect(error).deep.include({kind: 'forbidden', detail: 'no'});
    expect(warnings).is.empty;
  });

  it('isFinished does not read the newest save again once it saw it in END', async () => {
    storeLengths([0, 2, 5]);
    let reads = 0;
    const getGameVersion = db.getGameVersion.bind(db);
    db.getGameVersion = (gameId, saveId) => {
      reads++;
      return getGameVersion(gameId, saveId);
    };
    expect(await isFinished(game)).is.true;
    expect(await isFinished(game)).is.true;
    expect(reads).eq(1);
    clearReplayCache();
    expect(await isFinished(game)).is.true;
    expect(reads).eq(2);
  });

  it('isFinished does not remember a game whose END save has not landed', async () => {
    storeLengths([0, 2, 5]);
    const rows = db.games.get(game.id)!;
    rows[2] = {...rows[2]!, phase: Phase.ACTION};
    expect(await isFinished(game)).is.false;
    rows[2] = {...rows[2]!, phase: Phase.END};
    expect(await isFinished(game)).is.true;
  });

  it('answers expired, uncached, when compression removes saves while the list is built', async () => {
    storeLengths([0, 2, 5]);
    const rows = db.games.get(game.id)!;
    const middle = rows[1]!;
    const getGameVersion = db.getGameVersion.bind(db);
    let reads = 0;
    db.getGameVersion = (gameId, saveId) => {
      // The first read is the newest save, for isFinished. Then compression strikes.
      if (++reads === 2) {
        delete rows[1];
      }
      return getGameVersion(gameId, saveId);
    };
    expect(await getReplayMoves(game, player.id)).deep.eq({status: 'expired'});

    rows[1] = middle;
    expect((await moves()).map((m) => m.saveId)).deep.eq([0, 1, 2]);
  });

  describe('sandbox cache', () => {
    let reads: number;

    // Counts every database read, the list of saves included.
    function countReads() {
      reads = 0;
      const getGameVersion = db.getGameVersion.bind(db);
      const getSaveIds = db.getSaveIds.bind(db);
      db.getGameVersion = (gameId, saveId) => {
        reads++;
        return getGameVersion(gameId, saveId);
      };
      db.getSaveIds = (gameId) => {
        reads++;
        return getSaveIds(gameId);
      };
    }

    beforeEach(() => {
      storeLengths([0, 2, 5]);
      countReads();
    });

    it('serves a second view of the same save from memory', async () => {
      const first = await loadReplayState(game, 1);
      const readsAfterFirst = reads;
      const second = await loadReplayState(game, 1);
      expect(second).eq(first);
      expect(reads).eq(readsAfterFirst);
    });

    it('reads the save again after forgetReplay', async () => {
      const first = await loadReplayState(game, 1);
      forgetReplay(game.id);
      expect(await loadReplayState(game, 1)).not.eq(first);
    });

    it('does not keep the newest save of a running game', async () => {
      game.phase = Phase.ACTION;
      const first = await loadReplayState(game, 2);
      expect(await loadReplayState(game, 2)).not.eq(first);
      // Older saves of a running game do not change.
      const older = await loadReplayState(game, 1);
      expect(await loadReplayState(game, 1)).eq(older);
    });

    it('drops the least recently used sandbox beyond eight', async () => {
      storeLengths([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const loaded = [];
      for (let saveId = 0; saveId <= 7; saveId++) {
        loaded.push(await loadReplayState(game, saveId));
      }
      // A hit makes save 0 the most recent, so save 1 is the oldest.
      expect(await loadReplayState(game, 0)).eq(loaded[0]);
      await loadReplayState(game, 8);
      expect(await loadReplayState(game, 0)).eq(loaded[0]);
      expect(await loadReplayState(game, 1)).not.eq(loaded[1]);
    });

    it('does not keep a failed load', async () => {
      const getGameVersion = db.getGameVersion.bind(db);
      db.getGameVersion = () => Promise.reject(new Error('Game not found'));
      expect(await errorOf(loadReplayState(game, 1))).instanceOf(RouteError);
      db.getGameVersion = getGameVersion;
      expect((await loadReplayState(game, 1)).isSandbox).is.true;
    });

    it('lets simultaneous views share one read', async () => {
      const [a, b] = await Promise.all([loadReplayState(game, 1), loadReplayState(game, 1)]);
      expect(b).eq(a);
      expect(reads).eq(2);
    });
  });
});
