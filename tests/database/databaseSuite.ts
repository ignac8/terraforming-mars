import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

import {ITestDatabase} from './ITestDatabase';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {testGame} from '../TestGame';
import {GameId, ParticipantId} from '../../src/common/Types';
import {statusCode} from '../../src/common/http/statusCode';
import {cast} from '@/common/utils/utils';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {DiscordUser} from '../../src/server/server/auth/discord';
import {IGame} from '../../src/server/IGame';
import {TableStatePatch} from '../../src/server/rewind/tableState';
import {SerializedGame} from '../../src/server/SerializedGame';

// Removes any fields that have undefined values, and filters undefined from arrays.
function stripUndefined(obj: unknown): unknown {
  if (obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.filter((v) => v !== undefined).map(stripUndefined);
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        result[k] = stripUndefined(v);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Describes a database test
 */
export type DatabaseTestDescriptor<T extends ITestDatabase> = {
  name: string,
  constructor: () => T,
  stats: any,
  omit?: Partial<{
    purgeUnfinishedGames: boolean,
    markFinished: boolean,
    moreCleaning: boolean,
    sessions: boolean,
    storeParticipants: boolean,
  }>,
  otherTests?(dbFactory: () => T): void,
};

// A patch that changes every table state field of `game`'s save.
export function tableStatePatch(game: IGame): TableStatePatch {
  const player = game.players[0];
  return {
    frozen: true,
    rewindVote: {id: 7, requester: player.id, saveId: 1, moveNumber: 1, generation: 1, cards: 'shuffle', yes: [player.id], status: 'open', expiresAt: 1234},
    rewindRequestLimits: {generation: 1, players: [player.id]},
    undoCount: game.undoCount + 1,
    timers: [{player: player.id, timer: {...player.timer.serialize(), sumElapsed: 4321}}],
  };
}

export function describeDatabaseSuite<T extends ITestDatabase>(dtor: DatabaseTestDescriptor<T>) {
  describe(dtor.name, () => {
    let db: T;
    beforeEach(() => {
      db = dtor.constructor();
      setTestDatabase(db);
      return db.initialize();
    });

    afterEach(async () => {
      restoreTestDatabase();
      await db.afterEach?.();
    });

    it('game is saved', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      Game.newInstance('game-id-1212', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      const allGames = await db.getGameIds();
      expect(allGames).deep.eq(['game-id-1212']);
    });

    it('getGameIds - removes duplicates', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid');
      cast(player.popWaitingFor(), SelectInitialCards);
      await db.lastSaveGamePromise;
      await db.saveGame(game);

      const allGames = await db.getGameIds();
      expect(allGames).deep.eq(['game-id-1212']);
    });

    it('getGameIds - includes finished games', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid');
      cast(player.popWaitingFor(), SelectInitialCards);
      await db.lastSaveGamePromise;
      Game.newInstance('game-id-2323', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;

      await db.markFinished(game.id);

      const allGameIds = await db.getGameIds();
      expect(allGameIds).has.members(['game-id-1212', 'game-id-2323']);
    });

    it('saveIds', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      expect(game.lastSaveId).eq(1);

      await db.saveGame(game);
      await db.saveGame(game);
      await db.saveGame(game);

      const allSaveIds = await db.getSaveIds(game.id);
      expect(allSaveIds).has.members([0, 1, 2, 3]);
    });

    it('getSaveIds returns only the requested game, not games sharing its id prefix', async () => {
      // One game's id can be a prefix of another's, since ids are variable-length
      // ('game-id-1' is a prefix of 'game-id-12'). getSaveIds must return only the
      // requested game's saves, not those of the longer-named game.
      const player1 = TestPlayer.BLACK.newPlayer();
      const game1 = Game.newInstance('game-id-1', [player1], player1, 'spectatorid1');
      await db.lastSaveGamePromise;
      await db.saveGame(game1);

      const player2 = TestPlayer.BLUE.newPlayer();
      const game2 = Game.newInstance('game-id-12', [player2], player2, 'spectatorid2');
      await db.lastSaveGamePromise;
      await db.saveGame(game2);
      await db.saveGame(game2);

      expect(await db.getSaveIds('game-id-1')).has.members([0, 1]);
      expect(await db.getSaveIds('game-id-12')).has.members([0, 1, 2]);
    });

    if (dtor.omit?.markFinished !== true) {
      it('markFinished', async () => {
        const player = TestPlayer.BLACK.newPlayer();
        const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid');
        await db.lastSaveGamePromise;
        await db.saveGame(game);
        await db.saveGame(game);
        await db.saveGame(game);

        expect(await db.getSaveIds(game.id)).has.members([0, 1, 2, 3]);
        expect(await db.status(game.id)).eq('running');

        await db.markFinished(game.id);

        expect(await db.status(game.id)).eq('finished');
        const saveIds = await db.getSaveIds(game.id);
        expect(saveIds).has.members([0, 1, 2, 3]);
        expect(await db.completedTime(game.id)).is.not.undefined;
      });

      if (dtor.omit?.moreCleaning !== true) {
        it('moreCleaning', async () => {
          async function createGame(id: GameId) {
            const player = TestPlayer.BLACK.newPlayer();
            const game = Game.newInstance(id, [player], player, 'spectatorid');
            await db.lastSaveGamePromise;
            await db.saveGame(game);
            await db.saveGame(game);
            await db.saveGame(game);

            expect(await db.status(game.id)).eq('running');

            await db.markFinished(game.id);

            expect(await db.status(game.id)).eq('finished');
          }

          // Create 2 finished games.
          await createGame('game1-id');
          await createGame('game2-id');

          expect(await db.getSaveIds('game1-id')).has.members([0, 1, 2, 3]);
          expect(await db.completedTime('game1-id')).is.not.undefined;

          expect(await db.getSaveIds('game2-id')).has.members([0, 1, 2, 3]);
          expect(await db.completedTime('game2-id')).is.not.undefined;

          await db.compressCompletedGames('2');

          expect(await db.getSaveIds('game1-id')).has.members([0, 1, 2, 3]);
          expect(await db.completedTime('game1-id')).is.not.undefined;

          expect(await db.getSaveIds('game2-id')).has.members([0, 1, 2, 3]);
          expect(await db.completedTime('game2-id')).is.not.undefined;

          await db.setCompletedTime('game2-id', 100);
          await db.compressCompletedGames('2');

          expect(await db.getSaveIds('game1-id')).has.members([0, 1, 2, 3]);
          expect(await db.completedTime('game1-id')).is.not.undefined;

          expect(await db.getSaveIds('game2-id')).has.members([0, 3]);
          expect(await db.completedTime('game2-id')).is.undefined;
        });
      }

      it('a rolled back finished game is no longer waiting for compression', async () => {
        const player = TestPlayer.BLACK.newPlayer();
        const game = Game.newInstance('game-id-rolled-back', [player], player, 'spectatorid');
        await db.lastSaveGamePromise;
        await db.saveGame(game);
        await db.saveGame(game);
        await db.saveGame(game);
        await db.markFinished(game.id);
        await db.setCompletedTime(game.id, 100);
        expect(await db.completedTime(game.id)).is.not.undefined;

        await db.deleteGameNbrSaves(game.id, 1);

        expect(await db.completedTime(game.id)).is.undefined;
        await db.compressCompletedGames('2');
        expect(await db.getSaveIds(game.id)).has.members([0, 1, 2]);
      });

      it('a reopened game keeps its saves and its finished status, and can finish again', async () => {
        const player = TestPlayer.BLACK.newPlayer();
        const game = Game.newInstance('game-id-reopened', [player], player, 'spectatorid');
        await db.lastSaveGamePromise;
        await db.saveGame(game);
        await db.saveGame(game);
        await db.saveGame(game);
        db.saveGameResults(game.id, 1, 5, game.gameOptions, []);
        await db.markFinished(game.id);
        await db.setCompletedTime(game.id, 100);
        // saveGameResults does not report when it is done.
        for (let i = 0; i < 100 && !(await db.hasGameResults(game.id)); i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(await db.hasGameResults(game.id)).is.true;

        await db.reopenFinishedGame(game.id);
        expect(await db.status(game.id)).eq('finished');
        await db.saveGame(game);

        expect(await db.completedTime(game.id)).is.undefined;
        expect(await db.hasGameResults(game.id)).is.false;
        await db.purgeUnfinishedGames('-1');
        await db.compressCompletedGames('0');
        expect(await db.getSaveIds(game.id)).has.members([0, 1, 2, 3, 4]);
        await db.markFinished(game.id);
        expect(await db.completedTime(game.id)).is.not.undefined;
      });
    }

    it('gets player count', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      expect(game.lastSaveId).eq(1);

      expect(db.getPlayerCount(game.id)).become(1);
    });

    it('does not find player count by id', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      expect(game.lastSaveId).eq(1);

      expect(db.getPlayerCount('g-notfound')).is.rejected;
    });

    if (dtor.omit?.purgeUnfinishedGames !== true) {
      it('purgeUnfinishedGames', async () => {
        const player = TestPlayer.BLACK.newPlayer();
        const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid');
        await db.lastSaveGamePromise;
        expect(game.lastSaveId).eq(1);

        await db.saveGame(game);
        await db.saveGame(game);
        await db.saveGame(game);

        expect(await db.getSaveIds(game.id)).has.members([0, 1, 2, 3]);

        // A finished game of the same age must NOT be purged: purgeUnfinishedGames
        // only removes games still in progress.
        const finishedPlayer = TestPlayer.BLUE.newPlayer();
        const finishedGame = Game.newInstance('g-finished-game-id', [finishedPlayer], finishedPlayer, 'spectatorid2');
        await db.lastSaveGamePromise;
        await db.markFinished(finishedGame.id);

        await db.purgeUnfinishedGames('1');
        expect(await db.getSaveIds(game.id)).has.members([0, 1, 2, 3]);
        const entry = (await db.getParticipants()).find((entry) => entry.gameId === game.id);
        expect(entry?.participantIds).deep.eq([player.id, 'spectatorid']);
        // Doesn't purge until the time has passed.
        await db.purgeUnfinishedGames('-1');
        // await db.purgeUnfinishedGames('0'); This doesn't work! I wonder if it's just too precise a clock problem.
        expect(await db.getSaveIds(game.id)).is.empty;
        const postPurgeEntry = (await db.getParticipants()).find((entry) => entry.gameId === game.id);
        expect(postPurgeEntry).is.undefined;

        // The finished game survived the purge even though it is just as old.
        expect(await db.getSaveIds(finishedGame.id)).is.not.empty;
      });
    }

    it('getGame', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid', {underworldExpansion: true});
      await db.lastSaveGamePromise;
      expect(game.lastSaveId).eq(1);

      player.megaCredits = 200;
      game.log('databaseSuite.getGame test');

      const expected = game.serialize();
      await db.saveGame(game);

      const actual = await db.getGame(game.id);
      expect(actual.gameLog[actual.gameLog.length -1].message).eq('databaseSuite.getGame test');
      expect(actual.gameOptions.underworldExpansion).eq(true);
      expect(stripUndefined(actual)).deep.eq(stripUndefined(expected));
    });

    it('getGameVersion', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      expect(game.lastSaveId).eq(1);

      player.megaCredits = 200;
      await db.saveGame(game);

      player.megaCredits = 300;
      await db.saveGame(game);

      player.megaCredits = 400;
      await db.saveGame(game);

      const allSaveIds = await db.getSaveIds(game.id);
      expect(allSaveIds).has.members([0, 1, 2, 3]);

      const serialized0 = await db.getGameVersion(game.id, 0);
      expect(serialized0.players[0].megaCredits).eq(0);

      const serialized1 = await db.getGameVersion(game.id, 1);
      expect(serialized1.players[0].megaCredits).eq(statusCode.ok);

      const serialized2 = await db.getGameVersion(game.id, 2);
      expect(serialized2.players[0].megaCredits).eq(300);

      const serialized3 = await db.getGameVersion(game.id, 3);
      expect(serialized3.players[0].megaCredits).eq(statusCode.badRequest);

      await expect(db.getGameVersion('game-id-123', 0)).to.be.rejectedWith(/Game game-id-123 not found/);
    });

    it('saveGame updates in place when re-saving an existing saveId', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      expect(game.lastSaveId).eq(1);

      // A normal save at a fresh saveId (1).
      player.megaCredits = 100;
      await db.saveGame(game);
      expect(await db.getSaveIds(game.id)).has.members([0, 1]);
      expect((await db.getGameVersion(game.id, 1)).players[0].megaCredits).eq(100);

      // Re-save the same saveId (1) with a changed value. This is the upsert / ON CONFLICT
      // path: the existing row is updated in place rather than adding a new save, and the
      // updated value reads back.
      player.megaCredits = 200;
      game.lastSaveId = 1;
      await db.saveGame(game);
      expect(await db.getSaveIds(game.id)).has.members([0, 1]);
      expect((await db.getGameVersion(game.id, 1)).players[0].megaCredits).eq(200);
    });

    it('two saveGame calls in a row write two rows', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      expect(game.lastSaveId).eq(1);

      // The second call starts before the first one finishes.
      player.megaCredits = 100;
      const first = db.saveGame(game);
      player.megaCredits = 200;
      const second = db.saveGame(game);
      await Promise.all([first, second]);

      expect(await db.getSaveIds(game.id)).has.members([0, 1, 2]);
      expect((await db.getGameVersion(game.id, 1)).players[0].megaCredits).eq(100);
      expect((await db.getGameVersion(game.id, 2)).players[0].megaCredits).eq(200);
    });

    it('patches the newest save\'s table state in place', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-patched', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      await db.saveGame(game);
      await db.saveGame(game);
      const version = async (saveId: number) => structuredClone(stripUndefined(await db.getGameVersion(game.id, saveId))) as SerializedGame;
      const before = await Promise.all([0, 1, 2].map(version));
      const logLength = (await db.getGame(game.id)).gameLog.length;
      const patch = tableStatePatch(game);

      expect(await db.updateNewestSave(game.id, 2, patch)).is.true;

      expect(await db.getSaveIds(game.id)).has.members([0, 1, 2]);
      const after = await version(2);
      expect(after.frozen).is.true;
      expect(after.rewindVote).deep.eq(patch.rewindVote);
      expect(after.rewindRequestLimits).deep.eq(patch.rewindRequestLimits);
      expect(after.undoCount).eq(patch.undoCount);
      expect(after.players[0].timer).deep.eq(patch.timers[0].timer);
      for (const key of Object.keys(before[2]) as Array<keyof SerializedGame>) {
        if (key !== 'undoCount' && key !== 'players') {
          expect(after[key], key).deep.eq(before[2][key]);
        }
      }
      expect({...after.players[0], timer: undefined}).deep.eq({...before[2].players[0], timer: undefined});
      for (const saveId of [0, 1]) {
        expect(await version(saveId)).deep.eq(before[saveId]);
      }
      const newest = await db.getGame(game.id);
      expect(newest.frozen).is.true;
      expect(newest.gameLog).has.length(logLength);

      expect(await db.updateNewestSave(game.id, 2, {...patch, frozen: false, rewindVote: undefined, rewindRequestLimits: undefined})).is.true;

      const cleared = await db.getGameVersion(game.id, 2);
      expect(cleared).not.to.have.any.keys('frozen', 'rewindVote', 'rewindRequestLimits');
      expect(cleared.undoCount).eq(patch.undoCount);
    });

    it('patches nothing unless the save is the newest', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-unpatched', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      await db.saveGame(game);
      await db.saveGame(game);
      const rows = async () => JSON.stringify(await Promise.all((await db.getSaveIds(game.id)).sort().map((saveId) => db.getGameVersion(game.id, saveId))));
      const before = await rows();

      for (const saveId of [1, 7]) {
        expect(await db.updateNewestSave(game.id, saveId, tableStatePatch(game))).is.false;
        expect(await rows()).eq(before);
      }

      await db.deleteGameNbrSaves(game.id, 1);
      expect(await db.updateNewestSave(game.id, 2, tableStatePatch(game))).is.false;
      expect(await db.getSaveIds(game.id)).has.members([0, 1]);
    });

    it('participantIds', async () => {
      expect(await db.getParticipants()).is.empty;
      testGame(2, {}, '1');
      await db.lastSaveGamePromise;
      expect(await db.getParticipants()).deep.eq([
        {
          'gameId': 'game-id1',
          'participantIds': [
            'p-player1-id1',
            'p-player2-id1',
            'spectator-id1',
          ],
        },
      ]);
      testGame(3, {}, '2');
      await db.lastSaveGamePromise;
      expect(await db.getParticipants()).deep.eq([
        {
          'gameId': 'game-id1',
          'participantIds': [
            'p-player1-id1',
            'p-player2-id1',
            'spectator-id1',
          ],
        },
        {
          'gameId': 'game-id2',
          'participantIds': [
            'p-player1-id2',
            'p-player2-id2',
            'p-player3-id2',
            'spectator-id2',
          ],
        },
      ]);
    });

    it('stores the judge id as a participant', async () => {
      const player = TestPlayer.BLUE.newPlayer();
      const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid', {judgeLink: true});
      await db.lastSaveGamePromise;

      const entry = (await db.getParticipants()).find((entry) => entry.gameId === game.id);
      expect(entry?.participantIds).includes(game.judgeId);
      expect(await db.getGameId(game.judgeId!)).eq(game.id);
    });

    if (dtor.omit?.storeParticipants !== true) {
      it('storeParticipants', async () => {
        const gameId: GameId = 'g-dup';
        const participantIds: Array<ParticipantId> = ['p-player1', 'p-player2'];

        await db.storeParticipants({gameId, participantIds});

        expect(await db.getParticipants()).deep.eq([{gameId, participantIds}]);
      });

      it('storeParticipants is reentrant', async () => {
        const gameId: GameId = 'g-dup';
        const participantIds: Array<ParticipantId> = ['p-player1', 'p-player2'];

        await db.storeParticipants({gameId, participantIds});
        await db.storeParticipants({gameId, participantIds});

        expect(await db.getParticipants()).deep.eq([{gameId, participantIds}]);
      });
    }

    it('getGameId by PlayerID and Spectator ID', async () => {
      testGame(2, {}, '1');
      await db.lastSaveGamePromise;
      testGame(3, {}, '2');
      await db.lastSaveGamePromise;
      expect(await db.getGameId('p-player1-id1')).eq('game-id1');
      expect(await db.getGameId('p-player3-id2')).eq('game-id2');
      expect(db.getGameId('p-unknown')).to.be.rejected;

      expect(await db.getGameId('spectator-id1')).eq('game-id1');
      expect(await db.getGameId('spectator-id2')).eq('game-id2');
      expect(db.getGameId('spectator-unknown')).to.be.rejected;
    });

    it('deleteGameNbrSaves', async () => {
      const player = TestPlayer.BLACK.newPlayer();
      const game = Game.newInstance('game-id-1212', [player], player, 'spectatorid');
      await db.lastSaveGamePromise;
      expect(game.lastSaveId).eq(1);

      await db.saveGame(game);
      await db.saveGame(game);
      await db.saveGame(game);
      await db.saveGame(game);
      await db.saveGame(game);

      expect(await db.getSaveIds(game.id)).has.members([0, 1, 2, 3, 4, 5]);

      await db.deleteGameNbrSaves(game.id, 2);

      const saveIds = await db.getSaveIds(game.id);
      expect(saveIds).has.members([0, 1, 2, 3]);
    });

    if (dtor.omit?.sessions !== true) {
      const discordUser = {id: 'xyz'} as DiscordUser;
      it('createSession', async () => {
        const expirationTimeMillis = Date.now() + 100000;
        await db.createSession({id: '123', expirationTimeMillis, data: {discordUser}});
        const sessions = await db.getSessions();
        expect(sessions).deep.eq([{id: '123', expirationTimeMillis, data: {discordUser}}]);
      });

      it('deleteSession', async () => {
        const expirationTimeMillis = Date.now() + 100000;
        await db.createSession({id: '123', expirationTimeMillis, data: {discordUser}});
        let sessions = await db.getSessions();
        expect(sessions).deep.eq([{id: '123', expirationTimeMillis, data: {discordUser}}]);
        await db.deleteSession('123');
        sessions = await db.getSessions();
        expect(sessions).to.be.empty;
      });

      it('expiredSession', async () => {
        const expirationTimeMillis = Date.now() - 1;
        await db.createSession({id: '123', expirationTimeMillis, data: {discordUser}});
        const sessions = await db.getSessions();
        expect(sessions).to.be.empty;
      });

      it('deleteExpiredSessions', async () => {
        const live = Date.now() + 100000;
        await db.createSession({id: 'live', expirationTimeMillis: live, data: {discordUser}});
        await db.createSession({id: 'expired', expirationTimeMillis: Date.now() - 1, data: {discordUser}});

        expect(await db.deleteExpiredSessions()).eq(1);
        expect(await db.getSessions()).deep.eq([{id: 'live', expirationTimeMillis: live, data: {discordUser}}]);

        // The live session survives a second pass, which has nothing left to remove.
        expect(await db.deleteExpiredSessions()).eq(0);
        expect(await db.getSessions()).has.length(1);
      });
    }

    it('stats', async () => {
      const result = await db.stats();
      expect(result).deep.eq(dtor.stats);
    });

    dtor.otherTests?.(() => db);
  });
}
