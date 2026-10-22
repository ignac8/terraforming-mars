import {describeDatabaseSuite} from './databaseSuite';
import {IGame} from '../../src/server/IGame';
import {IN_MEMORY_SQLITE_PATH, SQLite} from '../../src/server/database/SQLite';
import {GameId} from '../../src/common/Types';
import {RunResult} from 'better-sqlite3';
import {ITestDatabase, Status} from './ITestDatabase';
import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';

class TestSQLite extends SQLite implements ITestDatabase {
  public lastSaveGamePromise: Promise<void> = Promise.resolve();

  constructor() {
    super(IN_MEMORY_SQLITE_PATH, true);
  }

  public get database() {
    return this.db;
  }

  public override saveGame(game: IGame): Promise<void> {
    this.lastSaveGamePromise = super.saveGame(game);
    return this.lastSaveGamePromise;
  }

  public async status(gameId: GameId): Promise<Status> {
    const rows = await this.asyncAll('SELECT DISTINCT status FROM games WHERE game_id = ? ORDER BY save_id DESC LIMIT 1', [gameId]);
    const statusText = rows[0].status;

    if (statusText === 'running' || statusText === 'finished') {
      return statusText;
    }
    throw new Error('Invalid status for ' + gameId + ': ' + statusText);
  }

  async completedTime(gameId: GameId): Promise<number | undefined> {
    const row = await this.asyncGet('SELECT completed_time FROM completed_game WHERE game_id = $1', [gameId]);
    return row.completed_time;
  }

  async hasGameResults(gameId: GameId): Promise<boolean> {
    return (await this.asyncGet('SELECT 1 FROM game_results WHERE game_id = ?', [gameId])) !== undefined;
  }

  setCompletedTime(gameId: GameId, timestampSeconds: number): Promise<RunResult> {
    return this.asyncRun('UPDATE completed_game SET completed_time = to_timestamp(?) WHERE game_id = ?', [timestampSeconds, gameId]);
  }
}

describeDatabaseSuite({
  name: 'SQLite',
  constructor: () => new TestSQLite(),
  omit: {
    markFinished: true,
  },
  stats: {
    type: 'SQLite',
    path: ':memory:',
    size_bytes: -1,
  },
  otherTests: (dbFactory) => {
    it('a reopened game keeps its saves and its finished status, and can finish again', async () => {
      const db = dbFactory() as TestSQLite;
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-reopened', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      await db.saveGame(game);
      await db.saveGame(game);
      db.saveGameResults(game.id, 1, 5, game.gameOptions, []);
      await db.markFinished(game.id);
      const queued = () => db.database.prepare('SELECT 1 FROM completed_game WHERE game_id = ?').get(game.id) !== undefined;
      expect(queued()).is.true;
      expect(await db.hasGameResults(game.id)).is.true;

      await db.reopenFinishedGame(game.id);

      expect(queued()).is.false;
      expect(await db.hasGameResults(game.id)).is.false;
      expect(await db.status(game.id)).eq('finished');
      await db.purgeUnfinishedGames('0');
      await db.compressCompletedGames('0');
      expect(await db.getSaveIds(game.id)).has.members([0, 1, 2]);
      await db.markFinished(game.id);
      expect(queued()).is.true;
    });

    describe('compressCompletedGames default', () => {
      const savedEnv = process.env.COMPRESS_COMPLETED_GAMES_DAYS;
      beforeEach(() => {
        delete process.env.COMPRESS_COMPLETED_GAMES_DAYS;
      });
      afterEach(() => {
        if (savedEnv === undefined) {
          delete process.env.COMPRESS_COMPLETED_GAMES_DAYS;
        } else {
          process.env.COMPRESS_COMPLETED_GAMES_DAYS = savedEnv;
        }
      });

      async function finishedGame(db: TestSQLite, id: GameId, finishedDaysAgo: number) {
        const player = TestPlayer.BLACK.newPlayer();
        const game = Game.newInstance(id, [player], player, 'spectatorid');
        await db.lastSaveGamePromise;
        for (let i = 0; i < 5; i++) {
          await db.saveGame(game);
        }
        await db.markFinished(id);
        const completedTime = Math.floor(Date.now() / 1000) - finishedDaysAgo * 86400;
        db.database.prepare('UPDATE completed_game SET completed_time = ? WHERE game_id = ?').run(completedTime, id);
        expect(await db.getSaveIds(id)).has.members([0, 1, 2, 3, 4, 5]);
      }

      // compressCompletedGames does not wait for the individual game compressions.
      const settle = () => new Promise((resolve) => setImmediate(resolve));

      it('keeps every save of a game that just finished', async () => {
        const db = dbFactory() as TestSQLite;
        await finishedGame(db, 'game-recent', 0);

        await db.compressCompletedGames();
        await settle();

        expect(await db.getSaveIds('game-recent')).has.members([0, 1, 2, 3, 4, 5]);
      });

      it('keeps every save of a game that finished 13 days ago', async () => {
        const db = dbFactory() as TestSQLite;
        await finishedGame(db, 'game-13-days', 13);

        await db.compressCompletedGames();
        await settle();

        expect(await db.getSaveIds('game-13-days')).has.members([0, 1, 2, 3, 4, 5]);
      });

      it('keeps only the first and last save of a game that finished 15 days ago', async () => {
        const db = dbFactory() as TestSQLite;
        await finishedGame(db, 'game-15-days', 15);

        await db.compressCompletedGames();
        await settle();

        expect(await db.getSaveIds('game-15-days')).deep.eq([0, 5]);
      });

      it('keeps only the first and last save when given 0 days', async () => {
        const db = dbFactory() as TestSQLite;
        await finishedGame(db, 'game-today', 1);

        await db.compressCompletedGames('0');
        await settle();

        expect(await db.getSaveIds('game-today')).deep.eq([0, 5]);
      });

      it('keeps every save of a finished game that was rolled back, once it is old enough', async () => {
        const db = dbFactory() as TestSQLite;
        await finishedGame(db, 'game-rolled-back', 15);

        await db.deleteGameNbrSaves('game-rolled-back', 1);
        await db.compressCompletedGames();
        await settle();

        expect(await db.getSaveIds('game-rolled-back')).has.members([0, 1, 2, 3, 4]);
      });

      it('still deletes the saves when leaving the compression queue fails', async () => {
        const db = dbFactory() as TestSQLite;
        await finishedGame(db, 'game-queue-broken', 0);
        db.database.prepare('DROP TABLE completed_game').run();
        // Production does not throw quiet failures; the test database does.
        (db as unknown as {throwQuietFailures: boolean}).throwQuietFailures = false;
        const originalError = console.error;
        console.error = () => {};
        try {
          await db.deleteGameNbrSaves('game-queue-broken', 2);
        } finally {
          console.error = originalError;
        }

        expect(await db.getSaveIds('game-queue-broken')).has.members([0, 1, 2, 3]);
      });

      for (const invalid of ['', 'abc', '-5']) {
        it(`falls back to the default for the invalid value '${invalid}'`, async () => {
          const db = dbFactory() as TestSQLite;
          await finishedGame(db, 'game-invalid', 3);

          await db.compressCompletedGames(invalid);
          await settle();

          expect(await db.getSaveIds('game-invalid')).has.members([0, 1, 2, 3, 4, 5]);
        });
      }

      it('an env var overrides the default', async () => {
        const db = dbFactory() as TestSQLite;
        await finishedGame(db, 'game-env', 3);
        process.env.COMPRESS_COMPLETED_GAMES_DAYS = '2';

        await db.compressCompletedGames();
        await settle();

        expect(await db.getSaveIds('game-env')).deep.eq([0, 5]);
      });
    });
  },
});
