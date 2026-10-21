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
import {ReplayMove} from '../../src/common/replay/ReplayModel';
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

  it('takes the generation from each save', async () => {
    const log = logOf(5);
    storeSaves([[0, row(log, 0, 1)], [1, row(log, 2, 1)], [2, row(log, 5, 3)]]);
    expect((await moves()).map((m) => m.generation)).deep.eq([1, 1, 3]);
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
    expect(await getReplayMoves(game, player.id)).eq(first);
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
    expect(await getReplayMoves(other, other.playersInGenerationOrder[0].id)).eq(otherList);
  });

  it('drops the oldest cached move list past 50 entries', async () => {
    storeLengths([0, 2, 5]);
    const first = await getReplayMoves(game, 's-0' as PlayerId);
    for (let i = 1; i < 50; i++) {
      await getReplayMoves(game, `s-${i}` as PlayerId);
    }
    // Still 50 entries, so the first one is cached.
    expect(await getReplayMoves(game, 's-0' as PlayerId)).eq(first);
    await getReplayMoves(game, 's-50' as PlayerId);
    // The 51st entry pushed the first one out, so it is built again from the saves.
    expect(await getReplayMoves(game, 's-0' as PlayerId)).not.eq(first);
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
});
