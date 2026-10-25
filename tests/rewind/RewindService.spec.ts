import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {SerializedGame} from '../../src/server/SerializedGame';
import {GameLoader} from '../../src/server/database/GameLoader';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {clearReplayCache, getReplayMoves, loadReplayState, moversOf} from '../../src/server/replay/ReplayService';
import {readRebuildSaves} from '../../src/server/rewind/rebuild';
import {MAX_REWINDS, RewindActor, rewindGame, rewindMetrics, rewindTable} from '../../src/server/rewind/RewindService';
import {sameState} from '../../src/server/rewind/stateHash';
import {isTableLocked} from '../../src/server/rewind/tableLock';
import {barUntilNextGeneration, mayRequest} from '../../src/server/rewind/vote/RewindVote';
import {PlayerInput} from '../../src/server/routes/PlayerInput';
import {RouteError} from '../../src/server/routes/RouteError';
import {INVALID_REQUEST_ID} from '../../src/common/app/AppErrorId';
import {CardName} from '../../src/common/cards/CardName';
import {statusCode} from '../../src/common/http/statusCode';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {Phase} from '../../src/common/Phase';
import {Timer} from '../../src/common/Timer';
import {ParticipantId, PlayerId} from '../../src/common/Types';
import {ReplayMove} from '../../src/common/replay/ReplayModel';
import {cast} from '../../src/common/utils/utils';
import {restoreTestDatabase, restoreTestGameLoader, setTestDatabase, setTestGameLoader} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {FakeClock} from '../common/FakeClock';
import {MockRequest, MockResponse} from '../routes/HttpMocks';
import {RouteTestScaffolding} from '../routes/RouteTestScaffolding';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestingUtils';

let db: SnapshotDatabase;
let game: IGame;
let player: TestPlayer;

function choose(p: IPlayer, title: string) {
  const action = cast(p.getWaitingFor(), OrOptions);
  p.process({type: 'or', index: action.options.findIndex((option) => option.title === title), response: {type: 'option'}});
}

function rows(): Array<SerializedGame> {
  return db.games.get(game.id) as Array<SerializedGame>;
}

// True when `row` holds the moment `saved` holds. The log and the rewinds are left out.
function holdsMoment(row: SerializedGame, saved: SerializedGame): boolean {
  const {rewinds: _rewinds, ...state} = row;
  return sameState({...state, gameLog: saved.gameLog}, {...saved, rewinds: undefined});
}

async function refusal(rewind: Promise<unknown>): Promise<RouteError> {
  try {
    await rewind;
  } catch (e) {
    return cast(e, RouteError);
  }
  throw new Error('The rewind was not refused');
}

async function movesOf(g: IGame, viewerId: ParticipantId): Promise<Array<ReplayMove>> {
  const history = await getReplayMoves(g, viewerId);
  if (history.status !== 'available') {
    throw new Error(`no history: ${history.status}`);
  }
  return history.moves;
}

async function rebuilds(result: string): Promise<number> {
  return (await rewindMetrics.rebuilds.get()).values.find((v) => v.labels.result === result)?.value ?? 0;
}

describe('RewindService', () => {
  // Saves of the second generation played: its research phase, the action prompt after two heat
  // conversions, and the save that passing writes before production runs.
  let research: number;
  let convert: number;
  let pass: number;
  // The cards that research phase offered.
  let researchCards: Array<CardName>;

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

  it('keeps the time already spent', async () => {
    player.timer = Timer.deserialize({sumElapsed: 600_000, startedAt: 0, running: false, afterFirstAction: true, lastStoppedAt: 0});

    const restored = await rewindGame(game, player, convert, 'same');

    expect(restored.getPlayerById(player.id).timer.serialize().sumElapsed).eq(600_000);
    expect(rows()[rows().length - 1].players[0].timer.sumElapsed).eq(600_000);
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

  it('keeps a rewound finished game in memory when a load marks it for eviction again during the rewind', async () => {
    const database = new SnapshotDatabase();
    setTestDatabase(database);
    const clock = new FakeClock();
    const loader = GameLoader.newTestInstance({sleepMillis: 0, evictMillis: 100, idleMillis: 0, sweep: 'manual'}, clock);
    setTestGameLoader(loader);
    await play({lastGeneration: true, database});
    // A reader that loads the finished game while the rewind runs marks it, as loading any finished game does.
    const saveGame = database.saveGame.bind(database);
    database.saveGame = (saved) => {
      loader.mark(saved.id);
      return saveGame(saved);
    };

    const restored = await rewindGame(game, player, convert, 'same');
    clock.millis = 1000;
    loader.sweep();

    expect(await loader.isServed(restored)).is.true;
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
    // Inputs check the same lock.
    expect(isTableLocked(game.id)).is.true;
    expect((await refusal(rewindGame(game, player, research, 'same'))).detail).eq('A rewind is already running.');
    await first;
    expect(isTableLocked(game.id)).is.false;
    // `game` is the object the first rewind replaced.
    expect((await refusal(rewindGame(game, player, research, 'same'))).kind).eq('badRequest');

    const [other, otherPlayer] = testGame(1);
    expect((await refusal(rewindGame(other, otherPlayer, 0, 'same'))).kind).eq('forbidden');
  });
});

describe('RewindService whole table', () => {
  let player2: TestPlayer;
  // The second generation's research save.
  let secondResearch: number;
  // The save before player 2's last action of the second generation, after player 1 moved.
  let target: number;
  // With the draft variant, the save that starts the third generation's draft.
  let draft: number;
  // Without it, the third generation's research save, the newest save.
  let thirdResearch: number;

  // A two-player game, played to the research phase of the generation after next. With the draft
  // variant it plays the second generation's draft too, and stops when the third generation's draft
  // starts: a pick logs nothing, so no drafting save but the newest is a move in the history.
  async function playTable(options: {draftVariant?: boolean} = {}) {
    clearReplayCache();
    db = new SnapshotDatabase();
    setTestDatabase(db);
    [game, player, player2] = testGame(2, {undoOption: true, ...options});
    await GameLoader.getInstance().add(game);
    // Set outside any input, so the first generation's saves don't replay: rebuilds start at the
    // second generation's research save.
    game.phase = Phase.ACTION;
    player.heat = 40;
    player2.heat = 40;
    player.takeAction();
    choose(player, 'Pass for this generation');
    choose(player2, 'Pass for this generation');
    if (options.draftVariant) {
      for (let round = 0; round < 3; round++) {
        for (const p of [player, player2]) {
          p.process({type: 'card', cards: [cast(p.getWaitingFor(), SelectCard).cards[0].name]});
        }
      }
    }
    secondResearch = game.lastSaveId - 1;
    player.process({type: 'card', cards: []});
    player2.process({type: 'card', cards: []});
    if (options.draftVariant) {
      choose(player2, 'Pass for this generation');
      choose(player, 'Pass for this generation');
      draft = game.lastSaveId - 1;
      return;
    }
    // Player 2 goes first in the second generation.
    choose(player2, 'Convert 8 heat into temperature');
    choose(player2, 'Convert 8 heat into temperature');
    choose(player, 'Convert 8 heat into temperature');
    choose(player, 'Pass for this generation');
    target = game.lastSaveId - 1;
    choose(player2, 'Convert 8 heat into temperature');
    choose(player2, 'Pass for this generation');
    thirdResearch = game.lastSaveId - 1;
  }

  // Player 2 asked, and the vote passed.
  const vote = (): RewindActor => ({kind: 'vote', requester: player2});

  afterEach(() => {
    restoreTestDatabase();
    restoreTestGameLoader();
  });

  it('rewinds both players to before the other player\'s move and appends one save', async () => {
    await playTable();
    const before = structuredClone(rows());

    const restored = await rewindTable(game, target, {cards: 'same', clocks: 'keep'}, vote());

    expect(await GameLoader.getInstance().getGame(game.id)).eq(restored);
    expect(rows().slice(0, before.length)).deep.eq(before);
    expect(rows()).has.length(before.length + 1);
    const row = rows()[before.length];
    expect(holdsMoment(row, before[target])).is.true;
    const marker = row.gameLog[row.gameLog.length - 1];
    expect(marker.message).eq('${0} rewound the game to generation ${1} after a unanimous vote');
    // Everyone sees who asked.
    expect(marker.playerId).is.undefined;
    expect(marker.data.filter((d) => d.type === LogMessageDataType.PLAYER).map((d) => d.value)).deep.eq([player2.color]);
  });

  it('refuses an input that arrives while the table is being rewound', async () => {
    await playTable();
    // The route takes the game from its own loader, so it keeps the old object after the swap.
    const scaffolding = new RouteTestScaffolding();
    await scaffolding.ctx.gameLoader.add(game);
    const post = async (body: string): Promise<MockResponse> => {
      const req = new MockRequest();
      const res = new MockResponse();
      scaffolding.req = req;
      scaffolding.url = `/player/input?id=${player.id}`;
      const posting = scaffolding.post(PlayerInput.INSTANCE, res);
      const emit = Promise.resolve().then(() => {
        req.emitString(body);
        req.emitter.emit('end');
      });
      await Promise.all([emit, posting]);
      return res;
    };
    let release = () => {};
    const listed = new Promise<void>((resolve) => release = resolve);
    const getSaveIds = db.getSaveIds.bind(db);
    db.getSaveIds = async (gameId) => {
      await listed;
      return getSaveIds(gameId);
    };
    const before = structuredClone(rows());
    const inputs = structuredClone(game.inputsSinceSave);
    const answer = JSON.stringify({requestId: player.getWaitingFor()?.requestId, type: 'card', cards: []});

    const rewinding = rewindTable(game, target, {cards: 'same', clocks: 'keep'}, vote());
    expect(isTableLocked(game.id)).is.true;
    let res = await post(answer);

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(JSON.parse(res.content).id).eq(INVALID_REQUEST_ID);
    expect(JSON.parse(res.content).message).eq('The table is being rewound or frozen. Click OK to refresh this page.');
    expect(game.inputsSinceSave).deep.eq(inputs);
    expect(rows()).has.length(before.length);

    release();
    await rewinding;
    expect(rows()).has.length(before.length + 1);
    expect(holdsMoment(rows()[before.length], before[target])).is.true;

    res = await post(answer);
    expect(JSON.parse(res.content).message).eq('This game was rewound. Click OK to refresh this page.');
  });

  it('keeps the clock of the player whose move is undone with keep, and restores every other clock, and all with back', async () => {
    // Player 2 made the move after the target.
    for (const run of [{clocks: 'keep', running: false}, {clocks: 'keep', running: true}, {clocks: 'back', running: false}] as const) {
      await playTable();
      const players = [player, player2];
      players.forEach((p, i) => {
        p.timer = Timer.deserialize({sumElapsed: 600_000 + i, startedAt: Date.now() - 5000, running: run.running, afterFirstAction: true, lastStoppedAt: 0});
      });
      // Timers are not part of the moment's state, so the replay still matches the changed row.
      for (const [i, p] of rows()[target].players.entries()) {
        p.timer.sumElapsed = 300_000 + i;
      }
      const saved = structuredClone(rows()[target]);

      const restored = await rewindTable(game, target, {cards: 'same', clocks: run.clocks}, vote());

      players.forEach((p, i) => {
        const label = `${run.clocks} ${run.running} player ${i + 1}`;
        const sumElapsed = restored.getPlayerById(p.id).timer.serialize().sumElapsed;
        if (run.clocks === 'back' || p === player) {
          expect(sumElapsed, label).eq(saved.players.find((s) => s.id === p.id)!.timer.sumElapsed);
        } else if (run.running) {
          // The interval in progress counts too.
          expect(sumElapsed, label).gte(605_000 + i).lte(p.timer.countedElapsed());
        } else {
          expect(sumElapsed, label).eq(600_000 + i);
        }
      });
    }
  });

  it('keeps the clock of every player who answered the research step with keep', async () => {
    await playTable();
    // Both players bought their cards in the research step after secondResearch.
    const players = [player, player2];
    players.forEach((p, i) => {
      p.timer = Timer.deserialize({sumElapsed: 600_000 + i, startedAt: 0, running: false, afterFirstAction: true, lastStoppedAt: 0});
    });
    for (const [i, p] of rows()[secondResearch].players.entries()) {
      p.timer.sumElapsed = 300_000 + i;
    }

    const restored = await rewindTable(game, secondResearch, {cards: 'same', clocks: 'keep'}, vote());

    players.forEach((p, i) => {
      expect(restored.getPlayerById(p.id).timer.serialize().sumElapsed, `player ${i + 1}`).eq(600_000 + i);
    });
  });

  it('keeps every clock with keep when nothing says whose move is undone', async () => {
    await playTable();
    expect(rows()[target + 1].inputs?.[0]?.playerId).eq(player2.id);
    // A save written before answers were recorded.
    delete rows()[target + 1].inputs;
    const players = [player, player2];
    players.forEach((p, i) => {
      p.timer = Timer.deserialize({sumElapsed: 600_000 + i, startedAt: 0, running: false, afterFirstAction: true, lastStoppedAt: 0});
    });
    for (const [i, p] of rows()[target].players.entries()) {
      p.timer.sumElapsed = 300_000 + i;
    }

    const restored = await rewindTable(game, target, {cards: 'same', clocks: 'keep'}, vote());

    players.forEach((p, i) => {
      expect(restored.getPlayerById(p.id).timer.serialize().sumElapsed).eq(600_000 + i);
    });
  });

  it('reads the mover of the first move after a rewind from the row after the rewind\'s row', async () => {
    await playTable();
    const restored = await rewindTable(game, target, {cards: 'same', clocks: 'back'}, vote());
    // A rewind's own row holds no answers.
    const own = rows().length - 1;
    expect(rows()[own].inputs).deep.eq([]);
    choose(restored.getPlayerById(player2.id), 'Convert 8 heat into temperature');

    expect(await moversOf(restored, own)).deep.eq([player2.id]);
    expect((await movesOf(restored, player.id)).find((move) => move.saveId === own)?.movers).deep.eq([player2.color]);
  });

  it('does not credit the newest save to the player whose answer made it, after a reload', async () => {
    for (const phase of ['drafting', 'research'] as const) {
      await playTable({draftVariant: phase === 'drafting'});
      if (phase === 'drafting') {
        // A pick saves the draft. Nobody has answered since that save.
        const before = rows().length;
        player.process({type: 'card', cards: [cast(player.getWaitingFor(), SelectCard).cards[0].name]});
        expect(rows(), phase).has.length(before + 1);
      }
      const newest = rows().length - 1;
      if (phase === 'drafting') {
        expect(rows()[newest].inputs?.[0]?.playerId, phase).eq(player.id);
      }

      // A restart loads the newest save. The draft asks again without saving.
      const loaded = Game.deserialize(structuredClone(rows()[newest]));

      expect(await moversOf(loaded, newest), phase).deep.eq([]);
      const entries = await movesOf(loaded, player.id);
      expect(entries[entries.length - 1].saveId, phase).eq(newest);
      expect(entries[entries.length - 1].movers, phase).is.undefined;
      if (phase === 'research') {
        // Once the loaded game has saved, an answer after that save is the newest save's.
        loaded.getPlayerById(player.id).process({type: 'card', cards: []});
        expect(await moversOf(loaded, newest), phase).deep.eq([player.id]);
      }
    }
  });

  it('names whose move each entry of the move list is, the newest from the live game\'s answers', async () => {
    await playTable();
    const before = await movesOf(game, player.id);
    const at = before.findIndex((move) => move.saveId === target);
    expect(before[at].movers).deep.eq([player2.color]);
    expect(before[at - 1].movers).deep.eq([player.color]);
    // Nobody has answered since the newest save.
    expect(before[before.length - 1].saveId).eq(thirdResearch);
    expect(before[before.length - 1].movers).is.undefined;

    player.process({type: 'card', cards: []});
    expect(game.inputsSinceSave).has.length(1);

    expect(await moversOf(game, thirdResearch)).deep.eq([player.id]);
    const after = await movesOf(game, player.id);
    expect(after[after.length - 1].movers).deep.eq([player.color]);
  });

  it('lists every player who answered a research step as its movers, the newest from the live game', async () => {
    await playTable();
    const both = [player.color, player2.color];
    expect((await movesOf(game, player.id)).find((move) => move.saveId === secondResearch)?.movers).deep.eq(both);

    player.process({type: 'card', cards: []});
    expect((await movesOf(game, player.id)).find((move) => move.saveId === thirdResearch)?.movers).deep.eq([player.color]);

    player2.process({type: 'card', cards: []});
    expect((await movesOf(game, player.id)).find((move) => move.saveId === thirdResearch)?.movers).deep.eq(both);
  });

  it('lists the players who have answered so far in a research step of three, in answer order', async () => {
    clearReplayCache();
    db = new SnapshotDatabase();
    setTestDatabase(db);
    let player3: TestPlayer;
    [game, player, player2, player3] = testGame(3, {undoOption: true});
    await GameLoader.getInstance().add(game);
    game.phase = Phase.ACTION;
    player.takeAction();
    for (const p of [player, player2, player3]) {
      choose(p, 'Pass for this generation');
    }
    const research = game.lastSaveId - 1;

    player2.process({type: 'card', cards: []});
    player.process({type: 'card', cards: []});

    const newest = (await movesOf(game, player.id)).find((move) => move.saveId === research);
    expect(newest?.movers).deep.eq([player2.color, player.color]);
  });

  it('carries the freeze into the rewound game and its save, and starts no clock', async () => {
    await playTable();
    game.frozen = true;
    // Standing clocks. Stopping one that never started would add the time since 1970.
    const players = [player, player2];
    players.forEach((p, i) => {
      p.timer = Timer.deserialize({sumElapsed: 600_000 + i, startedAt: 0, running: false, afterFirstAction: true, lastStoppedAt: 0});
    });

    const restored = await rewindTable(game, target, {cards: 'same', clocks: 'keep'}, vote());

    expect(restored.frozen).is.true;
    expect(rows()[rows().length - 1].frozen).is.true;
    players.forEach((p) => {
      expect(restored.getPlayerById(p.id).timer.serialize().running).is.false;
    });
  });

  it('starts the prompted players\' clocks at the hand-over, not at the shared last stop', async () => {
    // A replay; a load that asks before it saves the moment; a load that asks after it.
    for (const run of [{cards: 'same', at: 'action', asked: 1}, {cards: 'shuffle', at: 'action', asked: 1}, {cards: 'shuffle', at: 'research', asked: 2}] as const) {
      await playTable();
      const label = `${run.cards} ${run.at}`;
      const lastStoppedAt = (Timer as any).lastStoppedAt;
      try {
        // Loading saves only moves the shared last stop forward, so it can lie ahead of now.
        const clock = new FakeClock();
        clock.millis = Date.now() + 3_600_000;
        const probe = Timer.newInstance(clock);
        probe.start();
        probe.stop();

        const restored = await rewindTable(game, run.at === 'action' ? target : secondResearch, {cards: run.cards, clocks: 'keep'}, vote());

        const running = restored.players.filter((p) => p.timer.serialize().running);
        expect(running.map((p) => p.id), label).deep.eq(restored.players.filter((p) => p.getWaitingFor() !== undefined).map((p) => p.id));
        expect(running, label).has.length(run.asked);
        for (const p of running) {
          expect(p.timer.getElapsed() - p.timer.serialize().sumElapsed, label).gte(0).lt(1000);
        }
      } finally {
        (Timer as any).lastStoppedAt = lastStoppedAt;
      }
    }
  });

  it('asks both players again from the saved draft hands, with one new save', async () => {
    // 'same' replays to the moment; a shuffle loads the save, and drafting asks again without saving.
    for (const cards of ['same', 'shuffle'] as const) {
      await playTable({draftVariant: true});
      const before = structuredClone(rows());
      const warn = console.warn;
      const warnings: Array<unknown> = [];
      console.warn = (...args) => warnings.push(args);
      let restored: IGame;
      try {
        restored = await rewindTable(game, draft, {cards, clocks: 'keep'}, vote());
      } finally {
        console.warn = warn;
      }

      // A warning would mean the replay did not match the recording.
      expect(warnings, cards).deep.eq([]);
      expect(rows(), cards).has.length(before.length + 1);
      for (const p of [player, player2]) {
        const offered = cast(restored.getPlayerById(p.id).getWaitingFor(), SelectCard).cards.map((card) => card.name);
        expect(offered, cards).deep.eq(before[draft].players.find((s) => s.id === p.id)!.draftHand);
      }
    }
  });

  it('keeps who may not ask for a rewind this generation, unless the rewind goes back a generation', async () => {
    for (const run of [{to: 'this generation', barred: true}, {to: 'an earlier generation', barred: false}] as const) {
      await playTable();
      game.rewindRequestLimits = barUntilNextGeneration(undefined, game, player.id);
      const limits = structuredClone(game.rewindRequestLimits);

      const restored = await rewindTable(game, run.barred ? thirdResearch : target, {cards: 'same', clocks: 'keep'}, {kind: 'vote', requester: player2});

      const row = rows()[rows().length - 1];
      expect(restored.rewindRequestLimits, run.to).deep.eq(run.barred ? limits : undefined);
      expect(row.rewindRequestLimits, run.to).deep.eq(run.barred ? limits : undefined);
      expect(mayRequest(restored.rewindRequestLimits, restored, player.id), run.to).eq(!run.barred);
    }
  });

  it('refuses a rewind past the limit and changes nothing', async () => {
    await playTable();
    // Records that touch no save.
    game.rewinds = Array.from({length: MAX_REWINDS}, () => ({saveId: -1, restoredSaveId: -1, logStart: 0, logEnd: 0}));
    const before = structuredClone(rows());

    const e = await refusal(rewindTable(game, target, {cards: 'same', clocks: 'keep'}, vote()));

    expect(e.detail).eq('This game was rewound too many times.');
    expect(rows()).deep.eq(before);
    expect(game.retired).is.false;
  });

  it('replays a move made after an earlier rewind from the save that rewind wrote', async () => {
    await playTable();
    const live = await rewindTable(game, target, {cards: 'same', clocks: 'keep'}, vote());
    const first = live.rewinds[0].saveId;
    for (let i = 0; i < 2; i++) {
      choose(live.getPlayerById(player2.id), 'Convert 8 heat into temperature');
    }
    // The save after the first rewind's own, which a replay starts from.
    const saves = await readRebuildSaves(live, first + 1);
    expect(saves.map((save) => save.lastSaveId)).deep.eq([first, first + 1]);
    const saved = structuredClone(rows()[first + 1]);
    const count = await rebuilds('replayed');

    await rewindTable(live, first + 1, {cards: 'same', clocks: 'keep'}, vote());

    expect(await rebuilds('replayed')).eq(count + 1);
    expect(holdsMoment(rows()[rows().length - 1], saved)).is.true;
  });
});
