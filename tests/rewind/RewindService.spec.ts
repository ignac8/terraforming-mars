import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {SerializedGame} from '../../src/server/SerializedGame';
import {GameLoader} from '../../src/server/database/GameLoader';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {clearReplayCache, getReplayMoves, loadReplayState} from '../../src/server/replay/ReplayService';
import {rewindGame, rewindMetrics} from '../../src/server/rewind/RewindService';
import {sameState} from '../../src/server/rewind/stateHash';
import {RouteError} from '../../src/server/routes/RouteError';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {Timer} from '../../src/common/Timer';
import {PlayerId} from '../../src/common/Types';
import {cast} from '../../src/common/utils/utils';
import {restoreTestDatabase, restoreTestGameLoader, setTestDatabase, setTestGameLoader} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {FakeClock} from '../common/FakeClock';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestingUtils';

describe('RewindService', () => {
  let db: SnapshotDatabase;
  let game: IGame;
  let player: TestPlayer;
  // Saves of the second generation played: its research phase, the action prompt after two heat
  // conversions, and the save that passing writes before production runs.
  let research: number;
  let convert: number;
  let pass: number;
  // The cards that research phase offered.
  let researchCards: Array<CardName>;

  function choose(p: IPlayer, title: string) {
    const action = cast(p.getWaitingFor(), OrOptions);
    p.process({type: 'or', index: action.options.findIndex((option) => option.title === title), response: {type: 'option'}});
  }

  // A solo game with Player undo, played to the research phase of the generation after next. With
  // `lastGeneration`, the second generation played is the last one, and passing ends the game.
  async function play(options: {lastGeneration?: boolean, database?: SnapshotDatabase} = {}) {
    clearReplayCache();
    db = options.database ?? new SnapshotDatabase();
    setTestDatabase(db);
    [game, player] = testGame(1, {undoOption: true});
    if (options.lastGeneration) {
      game.generation = game.lastSoloGeneration() - 1;
    }
    await GameLoader.getInstance().add(game);
    player.heat = 40;
    player.takeAction();
    choose(player, 'Pass for this generation');
    research = game.lastSaveId - 1;
    researchCards = cast(player.getWaitingFor(), SelectCard).cards.map((card) => card.name);
    player.process({type: 'card', cards: []});
    choose(player, 'Convert 8 heat into temperature');
    choose(player, 'Convert 8 heat into temperature');
    convert = game.lastSaveId - 1;
    choose(player, 'Pass for this generation');
    pass = game.lastSaveId - 2;
  }

  function rows(): Array<SerializedGame> {
    return db.games.get(game.id) as Array<SerializedGame>;
  }

  // True when `row` holds the moment `saved` holds. The log and the rewinds are left out.
  function holdsMoment(row: SerializedGame, saved: SerializedGame): boolean {
    const {rewinds: _rewinds, ...state} = row;
    return sameState({...state, gameLog: saved.gameLog}, saved);
  }

  async function rebuilds(result: string): Promise<number> {
    return (await rewindMetrics.rebuilds.get()).values.find((v) => v.labels.result === result)?.value ?? 0;
  }

  async function refusal(rewind: Promise<unknown>): Promise<RouteError> {
    try {
      await rewind;
    } catch (e) {
      return cast(e, RouteError);
    }
    throw new Error('The rewind was not refused');
  }

  beforeEach(() => play());

  afterEach(() => {
    restoreTestDatabase();
    restoreTestGameLoader();
  });

  it('restores the moment before the move and appends one save', async () => {
    const before = structuredClone(rows());
    const restored = await rewindGame(game, player, convert, 'same');

    expect(await GameLoader.getInstance().getGame(game.id)).eq(restored);
    expect(restored.getPlayerById(player.id).heat).eq(before[convert].players[0].heat);
    expect(rows().slice(0, before.length)).deep.eq(before);
    expect(rows()).has.length(before.length + 1);
    const row = rows()[before.length];
    expect(holdsMoment(row, before[convert])).is.true;
    expect(row.rewinds).deep.eq([{saveId: before.length, restoredSaveId: convert, logStart: before[convert].gameLog.length, logEnd: game.gameLog.length}]);
    expect(row.inputs).deep.eq([]);
    expect(row.undoCount).eq(game.undoCount + 1);

    // Loading the game saves it again, under the same id, before it asks for input. The record stays.
    Game.deserialize(structuredClone(row));
    expect(rows()).has.length(before.length + 1);
    expect(rows()[before.length].rewinds).deep.eq(row.rewinds);
  });

  it('rebuilds by replay when the recording matches and falls back to the save when it does not', async () => {
    for (const run of [{tamper: false, result: 'replayed'}, {tamper: true, result: 'mismatch'}]) {
      await play();
      if (run.tamper) {
        rows()[convert].inputs![0].stateHash = 'x';
      }
      const saved = structuredClone(rows()[convert]);
      const count = await rebuilds(run.result);

      await rewindGame(game, player, convert, 'same');

      expect(holdsMoment(rows()[rows().length - 1], saved)).is.true;
      expect(await rebuilds(run.result)).eq(count + 1);
    }
  });

  it('replays from a save written before inputs were recorded, once a reload has saved it again', async () => {
    player.process({type: 'card', cards: []});
    for (const row of rows()) {
      delete row.inputs;
    }
    // A restart loads the game from its newest save, which saves it again under the same id.
    const reloaded = Game.deserialize(structuredClone(rows()[rows().length - 1]));
    await GameLoader.getInstance().add(reloaded);
    const reloadedPlayer = reloaded.getPlayerById(player.id);
    choose(reloadedPlayer, 'Convert 8 heat into temperature');
    choose(reloadedPlayer, 'Convert 8 heat into temperature');
    const count = await rebuilds('replayed');

    await rewindGame(reloaded, reloadedPlayer, rows().length - 1, 'same');

    expect(await rebuilds('replayed')).eq(count + 1);
  });

  it('deals the same research cards with the same cards, and other ones after a shuffle', async () => {
    for (const cards of ['same', 'shuffle'] as const) {
      await play();
      const saved = structuredClone(rows()[research]);

      const restored = await rewindGame(game, player, research, cards);

      const offered = cast(restored.getPlayerById(player.id).getWaitingFor(), SelectCard).cards.map((card) => card.name);
      // The save is written before the deal.
      const drawPile = rows()[rows().length - 1].projectDeck.drawPile;
      if (cards === 'same') {
        expect(offered).deep.eq(researchCards);
        expect(drawPile).deep.eq(saved.projectDeck.drawPile);
      } else {
        expect(offered).not.deep.eq(researchCards);
        expect(drawPile).not.deep.eq(saved.projectDeck.drawPile);
        expect(drawPile).has.same.members(saved.projectDeck.drawPile);
      }
    }
  });

  it('keeps the time already spent and the seats claimed since', async () => {
    player.timer = Timer.deserialize({sumElapsed: 600_000, startedAt: 0, running: false, afterFirstAction: true, lastStoppedAt: 0});
    player.password = 'seat';
    game.judgePassword = 'judge';

    const restored = await rewindGame(game, player, convert, 'same');

    const restoredPlayer = restored.getPlayerById(player.id);
    expect(restoredPlayer.timer.serialize().sumElapsed).eq(600_000);
    expect(restoredPlayer.password).eq('seat');
    expect(restored.judgePassword).eq('judge');
    const row = rows()[rows().length - 1];
    expect(row.players[0].password).eq('seat');
    expect(row.judgePassword).eq('judge');
  });

  it('refuses a moment that can be neither rebuilt nor loaded and changes nothing', async () => {
    for (const cards of ['same', 'shuffle'] as const) {
      await play();
      rows()[convert].first = 'p-unknown' as PlayerId;
      const before = structuredClone(rows());

      const e = await refusal(rewindGame(game, player, convert, cards));

      expect(e.kind).eq('badRequest');
      expect(rows()).deep.eq(before);
      expect(await GameLoader.getInstance().getGame(game.id)).eq(game);
      expect(game.retired).is.false;
    }
  });

  it('leaves the live game in place when the rebuilt game fails to save', async () => {
    for (const cards of ['same', 'shuffle'] as const) {
      await play();
      const before = structuredClone(rows());
      db.saveGame = () => {
        throw new Error('disk full');
      };

      const e = await refusal(rewindGame(game, player, convert, cards));

      expect(e.kind).eq('badRequest');
      expect(rows()).deep.eq(before);
      expect(await GameLoader.getInstance().getGame(game.id)).eq(game);
      expect(game.retired).is.false;
    }
  });

  it('writes the live game back over a rebuilt game that was saved before the rewind failed', async () => {
    for (const lastGeneration of [false, true]) {
      await play({lastGeneration});
      const saveGame = db.saveGame.bind(db);
      let failed = false;
      db.saveGame = (g) => {
        const written = saveGame(g);
        if (!failed) {
          failed = true;
          throw new Error('disk full');
        }
        return written;
      };

      await refusal(rewindGame(game, player, convert, 'same'));

      expect(game.retired).is.false;
      expect(sameState(rows()[rows().length - 1], game.serialize())).is.true;
      if (lastGeneration) {
        expect((await getReplayMoves(game, game.spectatorId)).status).eq('available');
      }
      const restored = await rewindGame(game, player, convert, 'same');
      expect(restored.phase).eq(Phase.ACTION);
    }
  });

  it('restores the results and the replay of a finished game whose rewind failed after its save', async () => {
    const loader = GameLoader.newTestInstance({sleepMillis: 0, evictMillis: 100, idleMillis: 0, sweep: 'manual'}, new FakeClock());
    setTestGameLoader(loader);
    await play({lastGeneration: true});
    await game.finishing;
    const saveId = rows().length;
    // The rebuilt game's save lands but reports it late, and the hand-over fails meanwhile.
    let release = () => {};
    const saveGame = db.saveGame.bind(db);
    db.saveGame = (g) => {
      db.saveGame = saveGame;
      saveGame(g);
      return new Promise((resolve) => release = resolve);
    };
    loader.add = () => Promise.reject(new Error('add failed'));

    const rewinding = refusal(rewindGame(game, player, convert, 'same'));
    await new Promise((resolve) => setImmediate(resolve));
    // A replay view of the rebuilt save, asked for while it is the newest one.
    expect((await loadReplayState(game, saveId)).phase).eq(Phase.ACTION);
    release();
    await rewinding;

    expect(await db.hasGameResults(game.id)).is.true;
    expect((await loadReplayState(game, saveId)).phase).eq(Phase.END);
  });

  it('does not return from a failed rewind of a finished game before its results are written back', async () => {
    const loader = GameLoader.newTestInstance({sleepMillis: 0, evictMillis: 100, idleMillis: 0, sweep: 'manual'}, new FakeClock());
    setTestGameLoader(loader);
    await play({lastGeneration: true});
    await game.finishing;
    // The results INSERT settles late, as it can on PostgreSQL.
    const saveGameResults = db.saveGameResults.bind(db);
    db.saveGameResults = (...args) => new Promise<void>((resolve) => setTimeout(() => {
      saveGameResults(...args);
      resolve();
    }, 20));
    loader.add = () => Promise.reject(new Error('add failed'));

    await refusal(rewindGame(game, player, convert, 'same'));

    expect(await db.hasGameResults(game.id)).is.true;
  });

  it('writes one save when the answer that wrote the moment went on to save again', async () => {
    for (const cards of ['same', 'shuffle'] as const) {
      await play();
      const before = structuredClone(rows());
      expect(before[pass + 1].phase).eq(Phase.RESEARCH);

      const restored = await rewindGame(game, player, pass, cards);

      expect(rows()).has.length(before.length + 1);
      expect(rows()[before.length].phase).eq(Phase.ACTION);
      // Play went on to the research phase, as it did the first time.
      expect(restored.phase).eq(Phase.RESEARCH);
      expect(restored.lastSaveId).eq(before.length + 1);
    }
  });

  it('un-finishes a finished game once it is marked finished, and the game finishes again', async () => {
    const calls: Array<string> = [];
    let release = () => {};
    const marking = new Promise<void>((resolve) => release = resolve);
    const database = new SnapshotDatabase();
    const markFinished = database.markFinished.bind(database);
    database.markFinished = async (gameId) => {
      await marking;
      calls.push('markFinished');
      return markFinished(gameId);
    };
    const reopenFinishedGame = database.reopenFinishedGame.bind(database);
    database.reopenFinishedGame = (gameId) => {
      calls.push('reopenFinishedGame');
      return reopenFinishedGame(gameId);
    };
    await play({lastGeneration: true, database});
    expect(game.phase).eq(Phase.END);

    const rewinding = rewindGame(game, player, convert, 'same');
    await new Promise((resolve) => setImmediate(resolve));
    release();
    const restored = await rewinding;

    expect(calls).deep.eq(['markFinished', 'reopenFinishedGame']);
    expect(restored.phase).eq(Phase.ACTION);
    expect(await getReplayMoves(restored, restored.spectatorId)).deep.eq({status: 'not-finished'});

    choose(restored.getPlayerById(player.id), 'Pass for this generation');
    await restored.finishing;
    expect(restored.phase).eq(Phase.END);
    expect(calls).deep.eq(['markFinished', 'reopenFinishedGame', 'markFinished']);
    const moves = await getReplayMoves(restored, restored.spectatorId);
    expect(moves.status === 'available' && moves.moves[moves.moves.length - 1].saveId).eq(rows().length - 1);
  });

  it('keeps a rewound finished game in memory, and a finished game whose rewind failed is evicted as before', async () => {
    for (const fails of [false, true]) {
      const database = new SnapshotDatabase();
      setTestDatabase(database);
      const clock = new FakeClock();
      const loader = GameLoader.newTestInstance({sleepMillis: 0, evictMillis: 100, idleMillis: 0, sweep: 'manual'}, clock);
      setTestGameLoader(loader);
      await play({lastGeneration: true, database});
      if (fails) {
        db.saveGame = () => {
          throw new Error('disk full');
        };
      }

      const rewinding = rewindGame(game, player, convert, 'same');
      await (fails ? refusal(rewinding) : rewinding);
      clock.millis = 1000;
      loader.sweep();

      expect(await loader.isCached(game.id), String(fails)).eq(!fails);
    }
  });

  it('writes nothing from a replaced game, even when it ends', async () => {
    db = new SnapshotDatabase();
    setTestDatabase(db);
    [game, player] = testGame(1, {undoOption: true});
    game.generation = game.lastSoloGeneration();
    player.takeAction();
    const before = structuredClone(rows());
    game.retired = true;

    choose(player, 'Pass for this generation');
    await game.finishing;

    expect(game.phase).eq(Phase.END);
    expect(rows()).deep.eq(before);
  });

  it('refuses a move that is not in the history', async () => {
    const restored = await rewindGame(game, player, research, 'same');
    // The first rewind abandoned every save from `research` on, `convert` among them.
    for (const saveId of [convert, 999]) {
      const e = await refusal(rewindGame(restored, restored.getPlayerById(player.id), saveId, 'same'));
      expect(e.kind).eq('notFound');
    }
  });

  it('refuses a second rewind while one runs, a replaced game, and players who cannot rewind', async () => {
    const first = rewindGame(game, player, convert, 'same');
    expect((await refusal(rewindGame(game, player, research, 'same'))).detail).eq('A rewind is already running.');
    await first;
    // `game` is the object the first rewind replaced.
    expect((await refusal(rewindGame(game, player, research, 'same'))).kind).eq('badRequest');

    const [other, otherPlayer] = testGame(1);
    expect((await refusal(rewindGame(other, otherPlayer, 0, 'same'))).kind).eq('forbidden');
  });
});
